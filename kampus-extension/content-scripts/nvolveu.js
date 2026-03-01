/**
 * Kampus Content Script — NvolveU / CampusLabs Engage (unl.campuslabs.com)
 *
 * Runs on unl.campuslabs.com pages. Scrapes upcoming events from the
 * Engage platform, either by parsing the DOM on event listing pages or
 * by intercepting API responses from the Engage frontend.
 *
 * Scraped events are sent to the background service worker for backend sync.
 */

(function kampusNvolveU() {
  'use strict';

  /**
   * Free-food detection keywords (duplicated from parser.js for content script
   * isolation — content scripts cannot import ES modules).
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
   * Detects free food keywords in text.
   * @param {string} text
   * @returns {boolean}
   */
  function detectFreeFood(text) {
    const lower = (text || '').toLowerCase();
    return FOOD_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Extracts matched food keywords from text.
   * @param {string} text
   * @returns {string|null}
   */
  function extractFoodDetails(text) {
    const lower = (text || '').toLowerCase();
    const matches = FOOD_KEYWORDS.filter(kw => lower.includes(kw));
    return matches.length > 0 ? matches.join(', ') : null;
  }

  /**
   * Strips HTML tags and collapses whitespace.
   * @param {string} html
   * @returns {string}
   */
  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // -------------------------------------------------------------------------
  // DOM Scraping Strategy
  // -------------------------------------------------------------------------

  /**
   * Checks if the current page is an event listing or event detail page.
   * @returns {'listing'|'detail'|null}
   */
  function getPageType() {
    const url = window.location.href.toLowerCase();

    if (url.includes('/engage/events') || url.includes('/engage/event')) {
      if (url.match(/\/events?\/.+/)) {
        // Could be a detail page like /engage/event/12345
        const detailMatch = url.match(/\/events?\/(\d+)/);
        if (detailMatch) return 'detail';
      }
      return 'listing';
    }

    if (url.includes('/engage/organization') && url.includes('/events')) {
      return 'listing';
    }

    return null;
  }

  /**
   * Scrapes event cards from the Engage event listing page DOM.
   * CampusLabs Engage uses React, so the DOM structure may vary.
   * This targets common patterns in the rendered output.
   *
   * @returns {Array<object>} Parsed events
   */
  function scrapeEventListing() {
    const events = [];

    // Strategy 1: Look for event card elements (common Engage React output)
    const eventCards = document.querySelectorAll(
      '[data-testid="event-card"], ' +
      '[class*="EventCard"], ' +
      '[class*="event-card"], ' +
      '.event-list-item, ' +
      'a[href*="/engage/event/"]'
    );

    const seen = new Set();

    for (const card of eventCards) {
      try {
        const event = parseEventCard(card);
        if (event && event.title && !seen.has(event.title)) {
          seen.add(event.title);
          events.push(event);
        }
      } catch (err) {
        console.warn('[Kampus] NvolveU: failed to parse event card:', err);
      }
    }

    // Strategy 2: Look for structured event list containers
    if (events.length === 0) {
      const containers = document.querySelectorAll(
        '[class*="EventList"], [class*="event-list"], [role="list"]'
      );

      for (const container of containers) {
        const items = container.querySelectorAll('[role="listitem"], li, article');
        for (const item of items) {
          try {
            const event = parseGenericEventItem(item);
            if (event && event.title && !seen.has(event.title)) {
              seen.add(event.title);
              events.push(event);
            }
          } catch (err) {
            console.warn('[Kampus] NvolveU: failed to parse event item:', err);
          }
        }
      }
    }

    return events;
  }

  /**
   * Parses a single event card element into a structured event object.
   * @param {Element} card
   * @returns {object|null}
   */
  function parseEventCard(card) {
    // Extract event URL and ID
    let eventUrl = '';
    let sourceId = null;
    const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/engage/event/"]');
    if (link) {
      eventUrl = link.href || '';
      const idMatch = eventUrl.match(/\/event\/(\d+)/);
      if (idMatch) sourceId = idMatch[1];
    }

    // Extract title
    const titleEl = card.querySelector(
      'h3, h2, h4, [class*="title"], [class*="Title"], [class*="name"], [class*="Name"]'
    );
    const title = titleEl ? titleEl.textContent.trim() : (card.textContent || '').split('\n')[0].trim();

    if (!title) return null;

    // Extract date/time
    const dateEl = card.querySelector(
      '[class*="date"], [class*="Date"], [class*="time"], [class*="Time"], time'
    );
    const dateText = dateEl ? dateEl.textContent.trim() : '';
    const dateTimeAttr = dateEl ? (dateEl.getAttribute('datetime') || '') : '';

    // Extract location
    const locationEl = card.querySelector(
      '[class*="location"], [class*="Location"], [class*="venue"], [class*="place"]'
    );
    const location = locationEl ? locationEl.textContent.trim() : '';

    // Extract organization
    const orgEl = card.querySelector(
      '[class*="organization"], [class*="Organization"], [class*="org"], [class*="host"]'
    );
    const orgName = orgEl ? orgEl.textContent.trim() : '';

    // Extract description snippet
    const descEl = card.querySelector(
      '[class*="description"], [class*="Description"], [class*="summary"], p'
    );
    const description = descEl ? descEl.textContent.trim() : '';

    const combined = `${title} ${description}`;

    return {
      source: 'nvolveu',
      source_id: sourceId,
      title,
      description: description.slice(0, 1000),
      start_time: dateTimeAttr || null,
      end_time: null,
      location,
      org_name: orgName,
      event_url: eventUrl,
      date_text: dateText,
      has_free_food: detectFreeFood(combined),
      food_details: extractFoodDetails(combined),
    };
  }

  /**
   * Fallback parser for generic list items.
   * @param {Element} item
   * @returns {object|null}
   */
  function parseGenericEventItem(item) {
    const text = item.textContent.trim();
    if (!text || text.length < 10) return null;

    const link = item.querySelector('a');
    const eventUrl = link ? link.href : '';
    const idMatch = eventUrl.match(/\/event\/(\d+)/);

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] || '';

    return {
      source: 'nvolveu',
      source_id: idMatch ? idMatch[1] : null,
      title,
      description: lines.slice(1).join(' ').slice(0, 1000),
      start_time: null,
      end_time: null,
      location: '',
      org_name: '',
      event_url: eventUrl,
      date_text: '',
      has_free_food: detectFreeFood(text),
      food_details: extractFoodDetails(text),
    };
  }

  /**
   * Scrapes a single event detail page for richer data.
   * @returns {object|null}
   */
  function scrapeEventDetail() {
    const url = window.location.href;
    const idMatch = url.match(/\/events?\/(\d+)/);
    const sourceId = idMatch ? idMatch[1] : null;

    // Extract title
    const titleEl = document.querySelector('h1, h2, [class*="EventName"], [class*="event-name"]');
    const title = titleEl ? titleEl.textContent.trim() : '';
    if (!title) return null;

    // Extract description
    const descEl = document.querySelector(
      '[class*="EventDescription"], [class*="event-description"], [class*="description"], article'
    );
    const description = descEl ? descEl.textContent.trim() : '';

    // Extract date/time
    const dateEl = document.querySelector(
      '[class*="EventDate"], [class*="event-date"], time, [class*="date"]'
    );
    const dateText = dateEl ? dateEl.textContent.trim() : '';
    const dateTimeAttr = dateEl ? (dateEl.getAttribute('datetime') || '') : '';

    // Extract location
    const locationEl = document.querySelector(
      '[class*="EventLocation"], [class*="event-location"], [class*="location"]'
    );
    const location = locationEl ? locationEl.textContent.trim() : '';

    // Extract organization
    const orgEl = document.querySelector(
      '[class*="HostName"], [class*="host-name"], [class*="organization"]'
    );
    const orgName = orgEl ? orgEl.textContent.trim() : '';

    const combined = `${title} ${description}`;

    return {
      source: 'nvolveu',
      source_id: sourceId,
      title,
      description: description.slice(0, 1000),
      start_time: dateTimeAttr || null,
      end_time: null,
      location,
      org_name: orgName,
      event_url: url,
      date_text: dateText,
      has_free_food: detectFreeFood(combined),
      food_details: extractFoodDetails(combined),
    };
  }

  // -------------------------------------------------------------------------
  // XHR/Fetch Interception Strategy
  // -------------------------------------------------------------------------

  /**
   * Intercepts fetch responses from the Engage API to capture event data
   * that the React frontend loads dynamically.
   */
  function setupFetchInterceptor() {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

        // Intercept event search API calls
        if (url.includes('/api/discovery/event/search') || url.includes('/api/discovery/event')) {
          const clone = response.clone();
          clone.json().then(data => {
            const items = data.items || data.value || (Array.isArray(data) ? data : []);
            if (items.length > 0) {
              processInterceptedEvents(items);
            }
          }).catch(() => {
            // Silently ignore parse errors on non-JSON responses
          });
        }
      } catch {
        // Do not break the page if interception fails
      }

      return response;
    };
  }

  /**
   * Processes events captured from intercepted API responses.
   * @param {Array} rawEvents
   */
  function processInterceptedEvents(rawEvents) {
    const events = rawEvents.map(raw => {
      const description = stripHtml(raw.description || '');
      const combined = `${raw.name || raw.title || ''} ${description}`;

      return {
        source: 'nvolveu',
        source_id: raw.id ? String(raw.id) : null,
        title: raw.name || raw.title || '',
        description: description.slice(0, 1000),
        start_time: raw.startsOn || raw.startDate || null,
        end_time: raw.endsOn || raw.endDate || null,
        location: raw.location || '',
        org_name: raw.organizationName || raw.hostName || '',
        event_url: raw.id ? `https://unl.campuslabs.com/engage/event/${raw.id}` : '',
        has_free_food: detectFreeFood(combined),
        food_details: extractFoodDetails(combined),
      };
    });

    if (events.length > 0) {
      sendToBackground(events, 'intercepted API');
    }
  }

  // -------------------------------------------------------------------------
  // Communication
  // -------------------------------------------------------------------------

  /**
   * Sends scraped events to the background service worker.
   * @param {Array<object>} events
   * @param {string} method - How the data was obtained (for logging)
   */
  function sendToBackground(events, method = 'DOM') {
    if (events.length === 0) {
      console.log('[Kampus] NvolveU: no events found to send.');
      return;
    }

    console.log(`[Kampus] NvolveU: scraped ${events.length} events via ${method}. Sending to background.`);

    chrome.runtime.sendMessage({
      type: 'NVOLVEU_EVENTS_SCRAPED',
      data: events,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Kampus] NvolveU: could not reach background worker:', chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        console.log('[Kampus] NvolveU: events synced successfully.');
        showSyncIndicator(events.length);
      } else {
        console.warn('[Kampus] NvolveU: event sync returned error:', response);
      }
    });
  }

  /**
   * Shows a subtle on-page indicator that Kampus synced events.
   * @param {number} count
   */
  function showSyncIndicator(count) {
    const existing = document.getElementById('kampus-sync-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'kampus-sync-indicator';
    indicator.textContent = `Kampus synced ${count} event${count !== 1 ? 's' : ''}`;
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #D00000;
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

    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }, 4000);
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  function init() {
    const pageType = getPageType();

    // Always set up the fetch interceptor to capture dynamic API data
    setupFetchInterceptor();

    if (pageType === 'detail') {
      console.log('[Kampus] NvolveU: event detail page detected.');
      setTimeout(() => {
        const event = scrapeEventDetail();
        if (event) {
          sendToBackground([event], 'detail page');
        }
      }, 2000);
    } else if (pageType === 'listing') {
      console.log('[Kampus] NvolveU: event listing page detected.');
      // Wait for React to render the event cards
      setTimeout(() => {
        const events = scrapeEventListing();
        sendToBackground(events, 'listing DOM');
      }, 3000);

      // Also observe for dynamically loaded content (infinite scroll)
      observeNewContent();
    } else {
      console.log('[Kampus] NvolveU: not an events page, interceptor still active.');
    }
  }

  /**
   * Sets up a MutationObserver to detect newly loaded event content
   * (e.g., from infinite scroll or pagination).
   */
  function observeNewContent() {
    let debounceTimer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const events = scrapeEventListing();
        if (events.length > 0) {
          sendToBackground(events, 'mutation observer');
        }
      }, 2000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Clean up after 5 minutes to avoid indefinite observation
    setTimeout(() => observer.disconnect(), 5 * 60 * 1000);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
