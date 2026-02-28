/**
 * Kampus API Client
 *
 * Handles all communication between the Chrome extension and the Kampus backend.
 * Reads the auth token from chrome.storage and attaches it to every request.
 * The base URL is configurable via chrome.storage (defaults to localhost:3000).
 */

const DEFAULT_API_BASE = 'http://localhost:3000';

/**
 * Retrieves the stored API configuration from chrome.storage.local.
 * @returns {Promise<{apiBase: string, token: string|null}>}
 */
async function getConfig() {
  const result = await chrome.storage.local.get(['kampusApiBase', 'kampusToken']);
  return {
    apiBase: result.kampusApiBase || DEFAULT_API_BASE,
    token: result.kampusToken || null,
  };
}

/**
 * Sets the Kampus auth token in storage.
 * @param {string} token
 */
async function setToken(token) {
  await chrome.storage.local.set({ kampusToken: token });
}

/**
 * Clears the stored auth token.
 */
async function clearToken() {
  await chrome.storage.local.remove('kampusToken');
}

/**
 * Sets a custom API base URL (useful for development vs. production).
 * @param {string} url
 */
async function setApiBase(url) {
  await chrome.storage.local.set({ kampusApiBase: url });
}

/**
 * Makes an authenticated request to the Kampus backend.
 *
 * @param {string} endpoint - API path (e.g. '/api/sync/assignments')
 * @param {object} options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {object} [options.body] - Request body (will be JSON-serialized)
 * @param {object} [options.headers] - Additional headers
 * @param {number} [options.timeout=30000] - Request timeout in ms
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function apiRequest(endpoint, options = {}) {
  const { apiBase, token } = await getConfig();
  const { method = 'GET', body, headers = {}, timeout = 30000 } = options;

  if (!token) {
    return { ok: false, status: 401, data: { error: 'No auth token configured. Please log in to Kampus.' } };
  }

  const url = `${apiBase}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return { ok: false, status: 0, data: { error: 'Request timed out' } };
    }

    return { ok: false, status: 0, data: { error: err.message } };
  }
}

/**
 * Syncs assignment data to the backend.
 * @param {Array} assignments
 */
async function syncAssignments(assignments) {
  return apiRequest('/api/sync/assignments', {
    method: 'POST',
    body: { assignments },
  });
}

/**
 * Syncs course data to the backend.
 * @param {Array} courses
 */
async function syncCourses(courses) {
  return apiRequest('/api/sync/courses', {
    method: 'POST',
    body: { courses },
  });
}

/**
 * Syncs class schedule data to the backend.
 * @param {Array} schedule
 */
async function syncSchedule(schedule) {
  return apiRequest('/api/sync/schedule', {
    method: 'POST',
    body: { classes: schedule },
  });
}

/**
 * Syncs grade data to the backend.
 * @param {Array} grades
 */
async function syncGrades(grades) {
  return apiRequest('/api/sync/grades', {
    method: 'POST',
    body: { grades },
  });
}

/**
 * Syncs NvolveU event data to the backend.
 * @param {Array} events
 */
async function syncNvolveUEvents(events) {
  return apiRequest('/api/sync/nvolveu-events', {
    method: 'POST',
    body: { events },
  });
}

/**
 * Syncs the user's live background location trace to the backend.
 * @param {object} location
 */
async function syncLocation(location) {
  return apiRequest('/api/sync/location', {
    method: 'POST',
    body: location,
  });
}

// Exported for use by background.js and other extension scripts via importScripts
// In Manifest V3 service workers, these are available globally when imported as a module.
export {
  DEFAULT_API_BASE,
  getConfig,
  setToken,
  clearToken,
  setApiBase,
  apiRequest,
  syncLocation,
  syncAssignments,
  syncCourses,
  syncSchedule,
  syncGrades,
  syncNvolveUEvents,
};
