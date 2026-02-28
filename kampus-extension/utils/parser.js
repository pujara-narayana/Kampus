/**
 * Kampus Parser Utilities
 *
 * HTML and JSON parsing helpers used by content scripts and the background
 * service worker to extract structured data from Canvas, MyRed, and NvolveU.
 */

/**
 * Strips HTML tags from a string and collapses whitespace.
 * @param {string} html - Raw HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates text to a maximum length, appending an ellipsis if truncated.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength = 500) {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '...';
}

/**
 * Parses a Canvas API course object into the Kampus course format.
 * @param {object} raw - Raw Canvas course JSON
 * @returns {object} Normalized course object
 */
function parseCanvasCourse(raw) {
  return {
    canvas_id: raw.id,
    name: raw.name || '',
    code: raw.course_code || '',
    term: raw.enrollment_term_id ? String(raw.enrollment_term_id) : null,
    workflow_state: raw.workflow_state,
  };
}

/**
 * Parses a Canvas API assignment object into the Kampus assignment format.
 * @param {object} raw - Raw Canvas assignment JSON
 * @param {number} courseId - Canvas course ID
 * @param {string} courseName - Human-readable course name
 * @returns {object} Normalized assignment object
 */
function parseCanvasAssignment(raw, courseId, courseName) {
  return {
    canvas_id: raw.id,
    course_id: courseId,
    course_name: courseName,
    name: raw.name || '',
    description: truncate(stripHtml(raw.description), 1000),
    due_at: raw.due_at || null,
    points_possible: raw.points_possible ?? 0,
    submission_types: raw.submission_types || [],
    has_submitted: Boolean(raw.has_submitted_submissions),
    html_url: raw.html_url || '',
    lock_at: raw.lock_at || null,
    unlock_at: raw.unlock_at || null,
    submitted_at: raw.submission ? raw.submission.submitted_at : null,
  };
}

/**
 * Parses Canvas enrollment data to extract grade information.
 * @param {object} enrollment - Raw Canvas enrollment JSON
 * @param {number} courseId - Canvas course ID
 * @returns {object} Grade data
 */
function parseCanvasGrade(enrollment, courseId) {
  const grades = enrollment.grades || {};
  return {
    course_id: courseId,
    current_grade: grades.current_grade || null,
    current_score: grades.current_score ?? null,
    final_grade: grades.final_grade || null,
    final_score: grades.final_score ?? null,
  };
}

/**
 * Parses a MyRed schedule table row (array of cell text values) into a
 * structured class schedule entry.
 *
 * MyRed renders the student's schedule as an HTML table with class
 * `datadisplaytable`. Each row contains cells for course info.
 *
 * @param {string[]} cells - Array of trimmed cell text content (length >= 7)
 * @returns {object|null} Parsed schedule entry or null if invalid
 */
function parseMyRedScheduleRow(cells) {
  if (!cells || cells.length < 7) return null;

  const course = cells[0] || '';
  const title = cells[1] || '';
  const days = cells[2] || '';
  const time = cells[3] || '';
  const building = cells[4] || '';
  const room = cells[5] || '';
  const instructor = cells[6] || '';

  // Skip header rows or empty rows
  if (!course || course.toLowerCase() === 'course') return null;

  // Parse time range (e.g. "2:00 pm - 2:50 pm")
  const timeParts = parseTimeRange(time);

  return {
    course_code: course.trim(),
    course_title: title.trim(),
    days: days.trim(),
    start_time: timeParts.start,
    end_time: timeParts.end,
    time_raw: time.trim(),
    building: building.trim(),
    room: room.trim(),
    instructor: instructor.trim(),
  };
}

/**
 * Parses a time range string like "2:00 pm - 2:50 pm" into start/end times.
 * @param {string} timeStr
 * @returns {{start: string|null, end: string|null}} Times in HH:MM 24-hour format
 */
function parseTimeRange(timeStr) {
  if (!timeStr) return { start: null, end: null };

  const parts = timeStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return { start: null, end: null };

  return {
    start: convertTo24Hour(parts[0]),
    end: convertTo24Hour(parts[1]),
  };
}

/**
 * Converts a 12-hour time string (e.g. "2:00 pm") to 24-hour format ("14:00").
 * @param {string} timeStr
 * @returns {string|null} Time in HH:MM format, or null if unparseable
 */
function convertTo24Hour(timeStr) {
  if (!timeStr) return null;

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toLowerCase();

  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Parses an NvolveU/Engage event object from DOM-scraped or API data.
 * @param {object} raw - Raw event data
 * @returns {object} Normalized event object
 */
function parseNvolveUEvent(raw) {
  const description = raw.description || '';
  return {
    source: 'nvolveu',
    source_id: raw.id ? String(raw.id) : null,
    title: raw.title || raw.name || '',
    description: truncate(stripHtml(description), 1000),
    description_raw: truncate(description, 2000),
    start_time: raw.startsOn || raw.start_time || null,
    end_time: raw.endsOn || raw.end_time || null,
    location: raw.location || '',
    org_name: raw.organizationName || raw.org_name || '',
    event_url: raw.url || raw.event_url || '',
    has_free_food: detectFreeFood(raw.title, description),
    food_details: extractFoodDetails(raw.title, description),
  };
}

/**
 * Keywords that indicate free food at an event.
 * @type {string[]}
 */
const FOOD_KEYWORDS = [
  'free food', 'free pizza', 'free lunch', 'free dinner', 'free breakfast',
  'lunch provided', 'dinner provided', 'refreshments', 'food will be served',
  'complimentary food', 'free snacks', 'pizza', 'catering', 'free meal',
  'food and drinks', 'snacks provided', 'free tacos', 'free bbq',
  'come for the food', 'treats', 'donuts', 'cookies provided',
];

/**
 * Scans title and description for food-related keywords.
 * @param {string} title
 * @param {string} description
 * @returns {boolean}
 */
function detectFreeFood(title, description) {
  const text = `${title || ''} ${stripHtml(description || '')}`.toLowerCase();
  return FOOD_KEYWORDS.some(keyword => text.includes(keyword));
}

/**
 * Extracts the specific food mention from the text.
 * @param {string} title
 * @param {string} description
 * @returns {string|null} e.g. "free pizza" or null
 */
function extractFoodDetails(title, description) {
  const text = `${title || ''} ${stripHtml(description || '')}`.toLowerCase();
  const matches = FOOD_KEYWORDS.filter(keyword => text.includes(keyword));
  return matches.length > 0 ? matches.join(', ') : null;
}

/**
 * Safely parses a JSON string, returning a fallback value on failure.
 * @param {string} jsonStr
 * @param {*} fallback
 * @returns {*}
 */
function safeJsonParse(jsonStr, fallback = null) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return fallback;
  }
}

/**
 * Generates a stable hash for deduplication of scraped items.
 * Uses a simple string-based hash (djb2) suitable for extension use.
 * @param {string} str
 * @returns {string} Hex hash string
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

export {
  stripHtml,
  truncate,
  parseCanvasCourse,
  parseCanvasAssignment,
  parseCanvasGrade,
  parseMyRedScheduleRow,
  parseTimeRange,
  convertTo24Hour,
  parseNvolveUEvent,
  FOOD_KEYWORDS,
  detectFreeFood,
  extractFoodDetails,
  safeJsonParse,
  hashString,
};
