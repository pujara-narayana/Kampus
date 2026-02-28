/**
 * Kampus Content Script — Canvas (canvas.unl.edu)
 *
 * Runs on every page under canvas.unl.edu. Detects whether the user is
 * authenticated by looking for session indicators in the DOM, then notifies
 * the background service worker to trigger a Canvas API scrape.
 *
 * This script does NOT scrape data itself — Canvas has a proper REST API,
 * so the background worker handles all fetch() calls. This script's job is
 * simply to detect the session and forward page-level context.
 */

(function kampusCanvas() {
  'use strict';

  const DEBOUNCE_KEY = 'kampus_canvas_last_notify';
  const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes between notifications

  /**
   * Checks whether the user appears to be logged into Canvas.
   * Canvas renders specific elements only for authenticated users.
   * @returns {boolean}
   */
  function isLoggedIn() {
    // Canvas injects a global ENV object with user data when authenticated
    if (typeof ENV !== 'undefined' && ENV.current_user_id) {
      return true;
    }

    // Fallback: look for the global navigation profile link
    const profileLink = document.querySelector('#global_nav_profile_link');
    if (profileLink) return true;

    // Fallback: look for the user avatar in the navigation
    const avatar = document.querySelector('.ic-avatar');
    if (avatar) return true;

    // Fallback: check for the dashboard container (only rendered for logged-in users)
    const dashboard = document.getElementById('dashboard');
    if (dashboard) return true;

    return false;
  }

  /**
   * Detects the current Canvas context from the page URL and DOM.
   * @returns {object} Context information
   */
  function getPageContext() {
    const url = window.location.href;
    const context = {
      url,
      page: 'unknown',
      courseId: null,
      assignmentId: null,
    };

    // /courses/:id
    const courseMatch = url.match(/\/courses\/(\d+)/);
    if (courseMatch) {
      context.courseId = parseInt(courseMatch[1], 10);
    }

    // /courses/:id/assignments/:id
    const assignmentMatch = url.match(/\/courses\/\d+\/assignments\/(\d+)/);
    if (assignmentMatch) {
      context.assignmentId = parseInt(assignmentMatch[1], 10);
    }

    // Identify page type
    if (url.includes('/dashboard')) {
      context.page = 'dashboard';
    } else if (url.includes('/assignments')) {
      context.page = 'assignments';
    } else if (url.includes('/grades')) {
      context.page = 'grades';
    } else if (url.includes('/courses')) {
      context.page = 'courses';
    } else if (url.includes('/calendar')) {
      context.page = 'calendar';
    }

    return context;
  }

  /**
   * Notifies the background worker that a Canvas session is active.
   * Debounced to avoid flooding with messages on rapid navigation.
   */
  function notifyBackground() {
    const now = Date.now();
    const lastNotify = parseInt(sessionStorage.getItem(DEBOUNCE_KEY) || '0', 10);

    if (now - lastNotify < DEBOUNCE_MS) {
      return; // Too soon since last notification
    }

    sessionStorage.setItem(DEBOUNCE_KEY, String(now));

    const context = getPageContext();

    chrome.runtime.sendMessage({
      type: 'CANVAS_SESSION_ACTIVE',
      context,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Kampus] Could not reach background worker:', chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success) {
        console.log('[Kampus] Canvas session notification sent successfully.');
      }
    });
  }

  /**
   * Observes the Canvas user's ID from the global ENV object if available.
   * This is useful for multi-user disambiguation.
   * @returns {number|null}
   */
  function getCurrentUserId() {
    if (typeof ENV !== 'undefined' && ENV.current_user_id) {
      return ENV.current_user_id;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  function init() {
    if (!isLoggedIn()) {
      console.log('[Kampus] Canvas: user not logged in. Waiting...');
      // Retry once after a short delay (Canvas may hydrate the DOM asynchronously)
      setTimeout(() => {
        if (isLoggedIn()) {
          console.log('[Kampus] Canvas: user login detected on retry.');
          notifyBackground();
        }
      }, 3000);
      return;
    }

    console.log('[Kampus] Canvas: user is logged in. Notifying background worker.');
    notifyBackground();
  }

  // Run after DOM is fully loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
