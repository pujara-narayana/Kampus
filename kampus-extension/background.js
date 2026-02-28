/**
 * Kampus Background Service Worker
 *
 * Orchestrates periodic scraping of Canvas, MyRed, and NvolveU using the
 * user's existing browser sessions. Scraped data is forwarded to the Kampus
 * backend via authenticated API calls.
 *
 * Alarm schedule:
 *   - canvas-sync:   every 30 minutes (courses, assignments, grades)
 *   - myred-sync:    every 1440 minutes (once daily, class schedule)
 *   - nvolveu-sync:  every 120 minutes (every 2 hours, events)
 */

import {
  syncAssignments,
  syncCourses,
  syncSchedule,
  syncGrades,
  syncNvolveUEvents,
  syncLocation,
  getConfig,
} from './utils/api.js';

import {
  parseCanvasCourse,
  parseCanvasAssignment,
  parseCanvasGrade,
  parseNvolveUEvent,
} from './utils/parser.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_BASE = 'https://canvas.unl.edu';
const CANVAS_API = `${CANVAS_BASE}/api/v1`;

const ALARM_CANVAS = 'canvas-sync';
const ALARM_MYRED = 'myred-sync';
const ALARM_NVOLVEU = 'nvolveu-sync';
const ALARM_GRADES = 'grades-sync';
const ALARM_LOCATION = 'location-sync';

// ---------------------------------------------------------------------------
// Lifecycle — Install & Alarm Setup
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Kampus] Extension installed. Setting up alarms.');
  setupAlarms();
  updateBadge('idle');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Kampus] Service worker started. Ensuring alarms exist.');
  setupAlarms();
});

function setupAlarms() {
  chrome.alarms.create(ALARM_CANVAS, { delayInMinutes: 1, periodInMinutes: 60 });
  chrome.alarms.create(ALARM_MYRED, { delayInMinutes: 5, periodInMinutes: 60 });
  chrome.alarms.create(ALARM_NVOLVEU, { delayInMinutes: 2, periodInMinutes: 120 });
  chrome.alarms.create(ALARM_GRADES, { delayInMinutes: 10, periodInMinutes: 360 });
  chrome.alarms.create(ALARM_LOCATION, { delayInMinutes: 0.5, periodInMinutes: 5 });
}

// ---------------------------------------------------------------------------
// Alarm Handler
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[Kampus] Alarm fired: ${alarm.name}`);

  const { token } = await getConfig();
  if (!token) {
    console.warn('[Kampus] No auth token set — skipping sync.');
    return;
  }

  switch (alarm.name) {
    case ALARM_CANVAS:
      await runCanvasSync();
      break;
    case ALARM_GRADES:
      await runGradesSync();
      break;
    case ALARM_MYRED:
      // Autonomously pop open a background tab to MyRed to scrape
      await runMyRedScraper();
      break;
    case ALARM_NVOLVEU:
      await runNvolveUSync();
      break;
    case ALARM_LOCATION:
      await runLocationSync();
      break;
  }
});

// ---------------------------------------------------------------------------
// Message Handler (from content scripts and popup)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    console.error('[Kampus] Message handler error:', err);
    sendResponse({ success: false, error: err.message });
  });

  // Return true to indicate we will respond asynchronously.
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    // Content script signals: Canvas session is active
    case 'CANVAS_SESSION_ACTIVE':
      console.log('[Kampus] Canvas session detected — triggering sync.');

      // Close the background tab if it was opened by our scraper
      if (sender && sender.tab && sender.tab.id && sender.tab.pinned) {
        chrome.tabs.remove(sender.tab.id).catch(() => { });
      }

      await runCanvasSync();
      return { success: true };

    // Content script sends scraped MyRed schedule
    case 'SCHEDULE_SCRAPED':
      console.log(`[Kampus] Received ${message.data.length} schedule entries from MyRed.`);
      await saveLastSync('myred');
      // Content script sends camelCase keys (course_code, course_title, etc.)
      // Normalize to match backend expectations
      const normalizedSchedule = message.data.map(c => ({
        courseCode: c.course_code || c.courseCode || '',
        courseTitle: c.course_title || c.courseTitle || '',
        days: c.days || '',
        startTime: c.start_time || c.startTime || null,
        endTime: c.end_time || c.endTime || null,
        building: c.building || '',
        room: c.room || '',
        instructor: c.instructor || '',
      }));
      const schedResult = await syncSchedule(normalizedSchedule);

      // Close the background tab if it was opened by our scraper
      if (sender && sender.tab && sender.tab.id && sender.tab.pinned) {
        chrome.tabs.remove(sender.tab.id).catch(() => { });
      }

      return { success: schedResult.ok, status: schedResult.status };

    // Content script sends scraped NvolveU events
    case 'NVOLVEU_EVENTS_SCRAPED':
      console.log(`[Kampus] Received ${message.data.length} events from NvolveU.`);
      await saveLastSync('nvolveu');
      // Normalize snake_case from content script to camelCase for backend
      const normalizedEvents = message.data.map(e => ({
        sourceId: e.source_id || e.sourceId || null,
        title: e.title || '',
        description: e.description || '',
        startTime: e.start_time || e.startTime || null,
        endTime: e.end_time || e.endTime || null,
        building: e.location || e.building || '',
        orgName: e.org_name || e.orgName || '',
        eventUrl: e.event_url || e.eventUrl || '',
        hasFreeFood: e.has_free_food || e.hasFreeFood || false,
        foodDetails: e.food_details || e.foodDetails || null,
      }));
      const evtResult = await syncNvolveUEvents(normalizedEvents);
      return { success: evtResult.ok, status: evtResult.status };

    // Popup requests current sync status
    case 'GET_SYNC_STATUS':
      return await getSyncStatus();

    // Popup triggers a manual full sync
    case 'MANUAL_SYNC':
      return await runFullSync();

    // Popup or web app sets the auth token
    case 'SET_TOKEN':
      await chrome.storage.local.set({ kampusToken: message.token });
      console.log('[Kampus] Auth token updated.');
      return { success: true };

    // Popup or web app sets the API base URL
    case 'SET_API_BASE':
      await chrome.storage.local.set({ kampusApiBase: message.apiBase });
      console.log(`[Kampus] API base updated to ${message.apiBase}`);
      return { success: true };

    // MyRed content script detected user identity — auto-register/login
    case 'MYRED_USER_DETECTED':
      console.log('[Kampus] MyRed user identity detected:', message.data);
      try {
        const regApiBase = (await chrome.storage.local.get('kampusApiBase')).kampusApiBase || 'http://localhost:3000';
        const regResponse = await fetch(`${regApiBase}/api/auth/extension-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.data),
        });
        if (regResponse.ok) {
          const regResult = await regResponse.json();
          await chrome.storage.local.set({
            kampusToken: regResult.token,
            kampusUser: JSON.stringify(regResult.user),
          });
          console.log('[Kampus] Auto-registered from MyRed:', regResult.user?.email || regResult.user?.displayName);

          // Close the MyRed popup/tab after successful registration
          if (sender && sender.tab && sender.tab.id) {
            try {
              await chrome.tabs.remove(sender.tab.id);
              console.log('[Kampus] Closed MyRed popup tab.');
            } catch (e) {
              // Tab may already be closed
            }
          }
        }
      } catch (err) {
        console.warn('[Kampus] MyRed auto-register failed:', err.message);
      }
      return { success: true };

    // MyRed content script scraped academic profile (major, college, etc.)
    case 'MYRED_PROFILE_SCRAPED':
      console.log('[Kampus] MyRed academic profile scraped:', message.data);
      try {
        const profToken = (await chrome.storage.local.get('kampusToken')).kampusToken;
        if (profToken) {
          const profApiBase = (await chrome.storage.local.get('kampusApiBase')).kampusApiBase || 'http://localhost:3000';
          await fetch(`${profApiBase}/api/sync/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${profToken}`,
            },
            body: JSON.stringify(message.data),
          });
          console.log('[Kampus] Academic profile synced.');
        }
      } catch (err) {
        console.warn('[Kampus] Profile sync failed:', err.message);
      }
      return { success: true };

    // Website or popup requests a MyRed sync (opens bg tab)
    case 'TRIGGER_MYRED_SYNC':
      console.log('[Kampus] MyRed sync triggered from website/popup.');
      await runMyRedScraper();
      return { success: true };

    default:
      console.warn(`[Kampus] Unknown message type: ${message.type}`);
      return { success: false, error: 'Unknown message type' };
  }
}

// ---------------------------------------------------------------------------
// Canvas Scraping
// ---------------------------------------------------------------------------

/**
 * Fetches a Canvas API endpoint using the user's session cookies.
 * @param {string} path - API path (e.g. '/courses?enrollment_state=active')
 * @returns {Promise<any>} Parsed JSON response
 */
async function canvasFetch(path) {
  const url = `${CANVAS_API}${path}`;
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    throw new Error(`Canvas API ${response.status}: ${url}`);
  }

  return response.json();
}

/**
 * Fetches all pages of a paginated Canvas API endpoint.
 * Canvas uses Link headers for pagination.
 * @param {string} path - Initial API path with query params
 * @returns {Promise<any[]>} Combined results from all pages
 */
async function canvasFetchAll(path) {
  const results = [];
  let url = `${CANVAS_API}${path}`;

  while (url) {
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      throw new Error(`Canvas API ${response.status}: ${url}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      results.push(...data);
    } else {
      results.push(data);
    }

    // Parse Link header for next page
    url = getNextPageUrl(response.headers.get('Link'));
  }

  return results;
}

/**
 * Extracts the "next" URL from a Canvas Link header.
 * Format: <https://...?page=2&per_page=50>; rel="next", <...>; rel="last"
 * @param {string|null} linkHeader
 * @returns {string|null}
 */
function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Scrapes active courses from Canvas and syncs to the backend.
 */
async function scrapeCanvasCourses() {
  console.log('[Kampus] Scraping Canvas courses...');

  const rawCourses = await canvasFetchAll(
    '/courses?per_page=50&include[]=term&include[]=total_scores'
  );

  const courses = rawCourses
    .filter(c => c.id && c.name)
    .map(c => {
      const parsed = parseCanvasCourse(c);
      return {
        canvasId: parsed.canvas_id,
        name: parsed.name,
        code: parsed.code,
        term: parsed.term,
      };
    });

  console.log(`[Kampus] Found ${courses.length} active courses.`);

  if (courses.length > 0) {
    const result = await syncCourses(courses);
    if (!result.ok) {
      console.error('[Kampus] Failed to sync courses:', result.data);
    }
  }

  return rawCourses;
}

/**
 * Scrapes assignments for all active courses and syncs to the backend.
 * @param {Array} courses - Array of raw Canvas course objects
 */
async function scrapeCanvasAssignments(courses) {
  console.log('[Kampus] Scraping Canvas assignments...');

  const allAssignments = [];

  for (const course of courses) {
    if (!course.id) continue;

    try {
      const rawAssignments = await canvasFetchAll(
        `/courses/${course.id}/assignments?per_page=50&order_by=due_at&include[]=submission`
      );

      const parsed = rawAssignments
        .filter(a => a.id && a.name)
        .map(a => {
          const p = parseCanvasAssignment(a, course.id, course.name);
          return {
            canvasId: p.canvas_id,
            courseCanvasId: p.course_id,
            name: p.name,
            description: p.description,
            dueAt: p.due_at,
            pointsPossible: p.points_possible,
            submissionTypes: p.submission_types,
            hasSubmitted: p.has_submitted,
            htmlUrl: p.html_url,
            submittedAt: p.submitted_at,
            score: a.submission ? a.submission.score : null,
          };
        });

      allAssignments.push(...parsed);
    } catch (err) {
      console.warn(`[Kampus] Failed to scrape assignments for course ${course.id}:`, err.message);
    }
  }

  console.log(`[Kampus] Found ${allAssignments.length} total assignments.`);

  if (allAssignments.length > 0) {
    const result = await syncAssignments(allAssignments);
    if (!result.ok) {
      console.error('[Kampus] Failed to sync assignments:', result.data);
    }
  }

  return allAssignments;
}

/**
 * Scrapes grades/enrollment for all active courses and syncs to the backend.
 * @param {Array} courses - Array of raw Canvas course objects
 */
async function scrapeCanvasGrades(courses) {
  console.log('[Kampus] Scraping Canvas grades...');

  const allGrades = [];

  for (const course of courses) {
    if (!course.id) continue;

    try {
      const enrollments = await canvasFetch(
        `/courses/${course.id}/enrollments?user_id=self&type[]=StudentEnrollment`
      );

      if (Array.isArray(enrollments)) {
        for (const enrollment of enrollments) {
          const g = parseCanvasGrade(enrollment, course.id);
          allGrades.push({
            courseCanvasId: g.course_id,
            currentGrade: g.current_grade,
            currentScore: g.current_score,
          });
        }
      }
    } catch (err) {
      console.warn(`[Kampus] Failed to scrape grades for course ${course.id}:`, err.message);
    }
  }

  console.log(`[Kampus] Found grades for ${allGrades.length} enrollments.`);

  if (allGrades.length > 0) {
    const result = await syncGrades(allGrades);
    if (!result.ok) {
      console.error('[Kampus] Failed to sync grades:', result.data);
    }
  }

  return allGrades;
}

// ---------------------------------------------------------------------------
// NvolveU Scraping (from background via fetch)
// ---------------------------------------------------------------------------

/**
 * Attempts to scrape NvolveU events via the Engage API.
 * CampusLabs Engage exposes a JSON API at /engage/api/discovery/event/search.
 */
async function scrapeNvolveUEvents() {
  console.log('[Kampus] Scraping NvolveU events...');

  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const response = await fetch(
      `https://unl.campuslabs.com/engage/api/discovery/event/search?startsAfter=${encodeURIComponent(now)}&startsBefore=${encodeURIComponent(futureDate)}&orderByField=endsOn&orderByDirection=ascending&status=Approved&take=50`,
      { credentials: 'include' }
    );

    if (!response.ok) {
      throw new Error(`NvolveU API ${response.status}`);
    }

    const data = await response.json();
    const rawEvents = data.items || data.value || data || [];

    if (!Array.isArray(rawEvents)) {
      console.warn('[Kampus] NvolveU response was not an array.');
      return [];
    }

    const events = rawEvents.map(e => {
      const p = parseNvolveUEvent(e);
      return {
        sourceId: p.source_id,
        title: p.title,
        description: p.description,
        startTime: p.start_time,
        endTime: p.end_time,
        building: p.location || '',
        orgName: p.org_name,
        eventUrl: p.event_url,
        hasFreeFood: p.has_free_food || false,
        foodDetails: p.food_details || null,
      };
    });
    console.log(`[Kampus] Found ${events.length} NvolveU events.`);

    if (events.length > 0) {
      const result = await syncNvolveUEvents(events);
      if (!result.ok) {
        console.error('[Kampus] Failed to sync NvolveU events:', result.data);
      }
    }

    return events;
  } catch (err) {
    console.warn('[Kampus] NvolveU background scrape failed:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sync Orchestration
// ---------------------------------------------------------------------------

async function runCanvasSync() {
  updateBadge('syncing');
  try {
    const courses = await scrapeCanvasCourses();
    await scrapeCanvasAssignments(courses);
    await saveLastSync('canvas');
    updateBadge('ok');
  } catch (err) {
    if (err.message.includes('401')) {
      console.log('[Kampus] Canvas session expired (401). Opening background tab to refresh SSO...');
      await openBackgroundScraper(CANVAS_BASE, 30000); // Wait up to 30s to bounce via SSO
      // The session should hopefully be active for the next alarm, or the user can click sync.
    } else {
      console.error('[Kampus] Canvas sync failed:', err);
    }
    updateBadge('error');
  }
}

async function runGradesSync() {
  updateBadge('syncing');
  try {
    const courses = await canvasFetchAll(
      '/courses?enrollment_state=active&per_page=50'
    );
    await scrapeCanvasGrades(courses);
    await saveLastSync('grades');
    updateBadge('ok');
  } catch (err) {
    console.error('[Kampus] Grades sync failed:', err);
    updateBadge('error');
  }
}

async function runNvolveUSync() {
  updateBadge('syncing');
  try {
    await scrapeNvolveUEvents();
    await saveLastSync('nvolveu');
    updateBadge('ok');
  } catch (err) {
    console.error('[Kampus] NvolveU sync failed:', err);
    updateBadge('error');
  }
}

async function runLocationSync() {
  console.log('[Kampus] Running live location sync...');
  try {
    // 1. Create the offscreen document if it doesn't already exist
    const creating = await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['GEOLOCATION'],
      justification: 'Kampus syncs user live location to the dashboard',
    }).catch(err => {
      // Ignore if document already exists error
      if (!err.message.includes('Only a single offscreen')) throw err;
    });

    // 2. Message the offscreen document to fetch coordinates
    const locationObj = await chrome.runtime.sendMessage({ type: 'GET_GEOLOCATION' });
    if (locationObj && !locationObj.error) {
      await syncLocation({
        latitude: locationObj.latitude,
        longitude: locationObj.longitude,
        timestamp: locationObj.timestamp,
        source: 'kampus-chrome-extension'
      });
      console.log(`[Kampus] Synced live location: ${locationObj.latitude}, ${locationObj.longitude}`);
    } else {
      console.warn('[Kampus] Location sync failed:', locationObj?.error);
    }

    // 3. Clean up the offscreen document to save memory
    await chrome.offscreen.closeDocument();
  } catch (err) {
    console.error('[Kampus] Failed to process location sync:', err);
  }
}

async function runFullSync() {
  console.log('[Kampus] Running full manual sync...');
  updateBadge('syncing');

  const results = { canvas: false, grades: false, nvolveu: false };

  try {
    const courses = await scrapeCanvasCourses();
    await scrapeCanvasAssignments(courses);
    await scrapeCanvasGrades(courses);
    await saveLastSync('canvas');
    await saveLastSync('grades');
    results.canvas = true;
    results.grades = true;
  } catch (err) {
    console.error('[Kampus] Canvas full sync error:', err);
    if (err.message.includes('401')) {
      await openBackgroundScraper(CANVAS_BASE, 30000);
    }
  }

  try {
    await scrapeNvolveUEvents();
    await saveLastSync('nvolveu');
    results.nvolveu = true;
  } catch (err) {
    console.error('[Kampus] NvolveU full sync error:', err);
  }

  // Also trigger MyRed background tab gracefully
  await runMyRedScraper();

  const allOk = results.canvas && results.grades && results.nvolveu;
  updateBadge(allOk ? 'ok' : 'error');

  return { success: true, results };
}

// ---------------------------------------------------------------------------
// Background Tab Autonomous Scraping
// ---------------------------------------------------------------------------

/**
 * Opens a URL in a pinned, inactive background tab to trigger content scripts.
 * The tab is automatically closed after a timeout to prevent clutter.
 */
async function openBackgroundScraper(url, timeoutMs = 60000) {
  try {
    const tab = await chrome.tabs.create({ url, active: false, pinned: true });

    // Monitor for login redirects (TrueYou or Canvas SSO)
    const urlListener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.url) {
        const urlLower = changeInfo.url.toLowerCase();
        if (urlLower.includes('trueyou.nebraska.edu') || urlLower.includes('login.unl.edu') || urlLower.includes('/login/')) {
          chrome.notifications.create('kampus-auth-' + tab.id, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Kampus Sync Paused',
            message: 'Your university session expired! Background sync is stuck on the login screen. Please log into MyRed or Canvas manually to resume.',
            priority: 2,
            requireInteraction: true
          });

          // Make the stuck background tab active so they can actually log in securely!
          chrome.notifications.onClicked.addListener(function authClick(notifId) {
            if (notifId === 'kampus-auth-' + tab.id) {
              chrome.tabs.update(tab.id, { active: true });
              chrome.notifications.onClicked.removeListener(authClick);
            }
          });

          chrome.tabs.onUpdated.removeListener(urlListener);
        }
      }
    };
    chrome.tabs.onUpdated.addListener(urlListener);

    // Safety timeout: close the tab after 60s if the content script failed/hung
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(urlListener);
      chrome.tabs.get(tab.id, (t) => {
        if (!chrome.runtime.lastError && t && !t.active) { // Don't close if they clicked it to log in
          console.log(`[Kampus] Scraper timeout: closing background tab ${tab.id}`);
          chrome.tabs.remove(tab.id).catch(() => { });
        }
      });
    }, timeoutMs);

    return tab;
  } catch (err) {
    console.error('[Kampus] Failed to open background scraper tab:', err);
  }
}

async function runMyRedScraper() {
  console.log('[Kampus] Launching autonomous MyRed scraper...');
  const scheduleUrl = 'https://myred.nebraska.edu/psp/myred/NBL/HRMS/c/SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL?Page=SSR_SSENRL_LIST&SPSrc=myred&IDPName=trueyou&GHInSess=1';
  await openBackgroundScraper(scheduleUrl, 60000); // 60s timeout
}

// ---------------------------------------------------------------------------
// MyRed Staleness Check
// ---------------------------------------------------------------------------

async function checkMyRedStaleness() {
  const status = await getSyncStatus();
  const lastMyRed = status.lastSync?.myred;

  if (!lastMyRed) {
    console.log('[Kampus] MyRed has never synced. User should visit their schedule page.');
    return;
  }

  const hoursSince = (Date.now() - lastMyRed) / (1000 * 60 * 60);
  if (hoursSince > 48) {
    console.log(`[Kampus] MyRed data is ${Math.round(hoursSince)}h old. Consider refreshing.`);
  }
}

// ---------------------------------------------------------------------------
// Sync Status & Storage
// ---------------------------------------------------------------------------

async function saveLastSync(source) {
  const key = `lastSync_${source}`;
  await chrome.storage.local.set({ [key]: Date.now() });
}

async function getSyncStatus() {
  const keys = ['lastSync_canvas', 'lastSync_myred', 'lastSync_nvolveu', 'lastSync_grades', 'kampusToken'];
  const data = await chrome.storage.local.get(keys);

  return {
    isAuthenticated: Boolean(data.kampusToken),
    lastSync: {
      canvas: data.lastSync_canvas || null,
      myred: data.lastSync_myred || null,
      nvolveu: data.lastSync_nvolveu || null,
      grades: data.lastSync_grades || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Badge Management
// ---------------------------------------------------------------------------

/**
 * Updates the extension badge to reflect current sync state.
 * @param {'idle'|'syncing'|'ok'|'error'} state
 */
function updateBadge(state) {
  const config = {
    idle: { text: '', color: '#6B7280' },
    syncing: { text: '...', color: '#3B82F6' },
    ok: { text: '', color: '#10B981' },
    error: { text: '!', color: '#EF4444' },
  };

  const { text, color } = config[state] || config.idle;

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}
