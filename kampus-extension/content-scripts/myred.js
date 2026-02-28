/**
 * Kampus Content Script — MyRed (myred.unl.edu)
 *
 * Runs on myred.unl.edu pages. When the user navigates to their class
 * schedule page, this script parses the HTML schedule table and sends
 * the structured data to the background service worker for backend sync.
 *
 * MyRed uses a Banner-style web interface that renders schedules in
 * HTML tables with the class `datadisplaytable`.
 */

(function kampusMyRed() {
  'use strict';

  /**
   * Checks if the current page contains a class schedule table.
   * @returns {boolean}
   */
  function isSchedulePage() {
    // Check URL patterns commonly used by Banner for schedule display
    const url = window.location.href.toLowerCase();
    const schedulePatterns = [
      'class_schedule',
      'bwskfshd',    // Banner schedule display
      'student_schedule',
      'detail_schedule',
      'concise_schedule',
      'student.main',         // The user's new link
      'cref=nbl_nvc',         // The user's new link
      'page=ssr_ss_week',     // The background scraper link
    ];

    if (schedulePatterns.some(p => url.includes(p))) {
      return true;
    }

    // Also check if a schedule table is present on the page
    const tables = document.querySelectorAll('.datadisplaytable');
    if (tables.length > 0) {
      // Check if any table contains schedule-like headers
      for (const table of tables) {
        const headers = table.querySelectorAll('th');
        const headerText = Array.from(headers).map(h => h.textContent.toLowerCase()).join(' ');
        if (headerText.includes('time') || headerText.includes('days') || headerText.includes('schedule')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Scrapes the class schedule from the datadisplaytable on the page.
   *
   * MyRed/Banner schedule tables vary in structure. This parser handles
   * the common UNL format where each course appears as a section with:
   *   - A header row containing the course title
   *   - A data table with columns for Type, Time, Days, Where, etc.
   *
   * @returns {Array<object>} Parsed schedule entries
   */
  function scrapeClassSchedule() {
    const classes = [];
    const tables = document.querySelectorAll('.datadisplaytable');

    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      let currentCourse = null;
      let currentTitle = null;

      for (const row of rows) {
        // Check for course header rows (typically in th or caption elements)
        const headerCell = row.querySelector('th.ddtitle, th.ddheader, caption.captiontext');
        if (headerCell) {
          const headerText = headerCell.textContent.trim();
          // Extract course code and title from header
          // Typical format: "Software Engineering - CSCE 361 - 001"
          const courseMatch = headerText.match(/(.+?)\s*-\s*([A-Z]{2,4}\s+\d{3}[A-Z]?)\s*-\s*(\d{3})/);
          if (courseMatch) {
            currentTitle = courseMatch[1].trim();
            currentCourse = `${courseMatch[2]} - ${courseMatch[3]}`;
          } else {
            // Try simpler pattern: "CSCE 361 - 001"
            const simpleMatch = headerText.match(/([A-Z]{2,4}\s+\d{3}[A-Z]?)\s*-\s*(\d{3})/);
            if (simpleMatch) {
              currentCourse = `${simpleMatch[1]} - ${simpleMatch[2]}`;
              currentTitle = headerText.replace(simpleMatch[0], '').replace(/^[\s-]+|[\s-]+$/g, '').trim() || currentCourse;
            }
          }
          continue;
        }

        // Parse data rows
        const cells = row.querySelectorAll('td.dddefault');
        if (cells.length >= 7) {
          const entry = {
            course_code: currentCourse || cells[0]?.textContent.trim() || '',
            course_title: currentTitle || cells[1]?.textContent.trim() || '',
            days: '',
            start_time: null,
            end_time: null,
            time_raw: '',
            building: '',
            room: '',
            instructor: '',
          };

          // Banner schedule tables typically have columns:
          // Type | Time | Days | Where | Date Range | Schedule Type | Instructors
          const type = cells[0]?.textContent.trim() || '';
          const time = cells[1]?.textContent.trim() || '';
          const days = cells[2]?.textContent.trim() || '';
          const where = cells[3]?.textContent.trim() || '';
          const instructor = cells[6]?.textContent.trim() || '';

          // Parse time (e.g., "2:00 pm - 2:50 pm")
          entry.time_raw = time;
          const timeParts = time.split('-').map(s => s.trim());
          if (timeParts.length === 2) {
            entry.start_time = convertTo24Hour(timeParts[0]);
            entry.end_time = convertTo24Hour(timeParts[1]);
          }

          // Parse days
          entry.days = days;

          // Parse location (e.g., "Avery Hall 115")
          const whereMatch = where.match(/^(.+?)\s+(\S+)\s*$/);
          if (whereMatch) {
            entry.building = whereMatch[1].trim();
            entry.room = whereMatch[2].trim();
          } else {
            entry.building = where;
          }

          // Parse instructor (remove "(P)" primary indicator)
          entry.instructor = instructor.replace(/\s*\(P\)\s*/g, '').trim();

          // Only add if we have meaningful data
          if (entry.days || entry.time_raw || entry.building) {
            classes.push(entry);
          }
        }
      }
    }

    // Fallback: try the simpler flat-table format
    if (classes.length === 0) {
      classes.push(...scrapeSimpleTable());
    }

    return classes;
  }

  /**
   * Fallback parser for a simpler flat table format where each row
   * contains all course data in sequential cells.
   * @returns {Array<object>}
   */
  function scrapeSimpleTable() {
    const classes = [];
    const rows = document.querySelectorAll('.datadisplaytable tr');

    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 7) {
        const courseText = cells[0]?.textContent.trim() || '';
        const titleText = cells[1]?.textContent.trim() || '';

        // Skip header-like rows
        if (!courseText || courseText.toLowerCase() === 'course' || courseText.toLowerCase() === 'crn') {
          continue;
        }

        const time = cells[3]?.textContent.trim() || '';
        const timeParts = time.split('-').map(s => s.trim());

        classes.push({
          course_code: courseText,
          course_title: titleText,
          days: cells[2]?.textContent.trim() || '',
          start_time: timeParts.length === 2 ? convertTo24Hour(timeParts[0]) : null,
          end_time: timeParts.length === 2 ? convertTo24Hour(timeParts[1]) : null,
          time_raw: time,
          building: cells[4]?.textContent.trim() || '',
          room: cells[5]?.textContent.trim() || '',
          instructor: cells[6]?.textContent.trim().replace(/\s*\(P\)\s*/g, '') || '',
        });
      }
    }

    return classes;
  }

  /**
   * Converts a 12-hour time string (e.g. "2:00 pm") to 24-hour format ("14:00").
   * @param {string} timeStr
   * @returns {string|null}
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
   * Sends scraped schedule data to the background service worker.
   * @param {Array<object>} classes
   */
  function sendToBackground(classes) {
    if (classes.length === 0) {
      console.log('[Kampus] MyRed: no schedule data found on this page.');
      return;
    }

    console.log(`[Kampus] MyRed: scraped ${classes.length} class entries. Sending to background.`);

    chrome.runtime.sendMessage({
      type: 'SCHEDULE_SCRAPED',
      data: classes,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Kampus] MyRed: could not reach background worker:', chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        console.log('[Kampus] MyRed: schedule synced successfully.');
        showSyncIndicator(classes.length);
      } else {
        console.warn('[Kampus] MyRed: schedule sync returned error:', response);
      }
    });
  }

  /**
   * Shows a subtle on-page indicator that Kampus synced the schedule.
   * @param {number} count - Number of classes synced
   */
  function showSyncIndicator(count) {
    // Remove any existing indicator
    const existing = document.getElementById('kampus-sync-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'kampus-sync-indicator';
    indicator.textContent = `Kampus synced ${count} class${count !== 1 ? 'es' : ''}`;
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10B981;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 99999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(indicator);

    // Fade out after 4 seconds
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }, 4000);
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  function init() {
    if (!isSchedulePage()) {
      console.log('[Kampus] MyRed: not a schedule page, skipping.');
      return;
    }

    console.log('[Kampus] MyRed: schedule page detected. Scraping...');

    // Small delay to ensure dynamic content has loaded
    setTimeout(() => {
      const classes = scrapeClassSchedule();
      sendToBackground(classes);
    }, 1000);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
