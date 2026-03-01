/**
 * Kampus Content Script — MyRed (myred.unl.edu / myred.nebraska.edu)
 *
 * Runs on MyRed pages. Scrapes the user's personal class list (enrollment list)
 * or schedule view and sends the structured data to the background for backend sync.
 *
 * We prioritize the personal enrollment list (SSR_SSENRL_LIST) so the extension
 * always scrapes from the logged-in user's own classes, not a generic page.
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
      'student.main',         // Dashboard / student main
      'student.main.ho',      // Dashboard schedule (post-login)
      'cref=nbl_nvc',         // Dashboard nav
      'weblib_dshboard',      // Dashboard iScript (schedule visible after login)
      'nbl_nvc_dash_student',
      'page=ssr_ss_week',
      'page=ssr_ssenrl_list',
    ];

    if (schedulePatterns.some(p => url.includes(p))) {
      return true;
    }

    // Also check for the user's personal enrollment/class list (SSR_SSENRL_LIST)
    if (url.includes('ssr_ssenrl_list') || url.includes('SSR_SSENRL_LIST')) {
      return true;
    }

    // Check if a schedule table is present on the page
    const tables = document.querySelectorAll('.datadisplaytable, .ps_grid-row, table.PSLEVEL1GRID');
    if (tables.length > 0) {
      for (const table of tables) {
        const headers = table.querySelectorAll('th');
        const headerText = Array.from(headers).map(h => h.textContent.toLowerCase()).join(' ');
        if (headerText.includes('time') || headerText.includes('days') || headerText.includes('schedule') ||
            headerText.includes('subject') || headerText.includes('course') || headerText.includes('enrollment') ||
            headerText.includes('class') || headerText.includes('section')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Returns true if the current page is the user's personal enrollment/class list
   * (SSR_SSENRL_LIST). This is the page we open for background scraping.
   */
  function isEnrollmentListPage() {
    const url = window.location.href.toLowerCase();
    return url.includes('ssr_ssenrl_list') || url.includes('SSR_SSENRL_LIST');
  }

  /**
   * Returns true if the current page is the student dashboard that shows the
   * schedule table right after login (Class, Days, Time, Delivery, Location, etc.).
   */
  function isDashboardSchedulePage() {
    const url = window.location.href.toLowerCase();
    return url.includes('student.main') || url.includes('weblib_dshboard') || url.includes('nbl_nvc_dash_student');
  }

  /**
   * Returns true if the cell text looks like a course code (e.g. "CSCE- 361 - 001", "MATH- 310 - 002").
   */
  function looksLikeCourseCode(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    return /^[A-Z]{2,5}\s*-\s*\d{3}[A-Z]?\s*-\s*\S+$/i.test(t) || /^[A-Z]{2,5}\s*\d{3}[A-Z]?\s*-\s*\d{3}/i.test(t) || /^[A-Z]{2,5}\s*-\s*\d{3}/i.test(t);
  }

  /**
   * Builds one schedule entry from row cells using column indices or fixed positions.
   */
  function buildScheduleEntry(classCell, days, timeRaw, locationRaw) {
    const courseCode = (classCell || '').replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();
    if (!courseCode) return null;
    let startTime = null;
    let endTime = null;
    if (timeRaw) {
      const timeParts = timeRaw.split('-').map(s => (s || '').trim());
      if (timeParts.length >= 2) {
        startTime = convertTo24Hour(timeParts[0]);
        endTime = convertTo24Hour(timeParts[1]);
      }
    }
    let building = (locationRaw || '').trim();
    let room = '';
    if (building && building.toUpperCase() !== 'ONLINE' && /[A-Za-z]+\s*-\s*\S+/.test(building)) {
      const m = building.match(/^([A-Za-z]+)\s*-\s*(\S+)/);
      if (m) {
        building = m[1].trim();
        room = m[2].trim();
      }
    }
    return {
      course_code: courseCode,
      course_title: courseCode,
      days: (days || '').trim(),
      start_time: startTime,
      end_time: endTime,
      time_raw: (timeRaw || '').trim(),
      building,
      room,
      instructor: '',
    };
  }

  /**
   * Scrapes the MyRed dashboard schedule table: table inside #Spring2026 (or similar id),
   * with tbody, first row = th (Class, Days, Time, ...), data rows = td with headers="classSpring2026" etc.
   * @returns {Array<object>} Parsed entries or empty
   */
  function scrapeMyRedScheduleTable() {
    const classes = [];
    let table = document.querySelector('div[id*="Spring20"] table') ||
      document.querySelector('div[id*="hschedd"] table') ||
      document.querySelector('.tab-pane.active table') ||
      document.querySelector('.zenbox .tab-content table');
    if (!table) {
      const cap = Array.from(document.querySelectorAll('table caption')).find(c => /Spring\s*20\d{2}/i.test(c.textContent || ''));
      if (cap) table = cap.closest('table');
    }
    if (!table) return classes;

    const tbody = table.querySelector('tbody');
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) return classes;

    const headerRow = rows[0];
    const headerCells = headerRow.querySelectorAll('th, td');
    const headerIds = Array.from(headerCells).map(c => (c.getAttribute('id') || '').toLowerCase());
    const headerTexts = Array.from(headerCells).map(c => (c.textContent || '').trim().toLowerCase());

    function colIndex(ids, idMatch, texts, textMatch) {
      const byId = ids.findIndex(id => id && idMatch(id));
      if (byId >= 0) return byId;
      return texts.findIndex(textMatch);
    }
    const idx = {
      class: colIndex(headerIds, id => id.includes('class') && !id.includes('campus'), headerTexts, h => h === 'class' || (h && h.includes('class') && !h.includes('campus'))),
      days: colIndex(headerIds, id => id.includes('days'), headerTexts, h => h === 'days' || (h && h.includes('days'))),
      time: colIndex(headerIds, id => id.includes('time'), headerTexts, h => h === 'time' || (h && h.includes('time'))),
      location: colIndex(headerIds, id => id.includes('location'), headerTexts, h => h === 'location' || (h && h.includes('location'))),
    };
    if (idx.class < 0) return classes;

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td, th');
      if (cells.length < 3) continue;
      const get = (index) => (index >= 0 && cells[index]) ? (cells[index].textContent || '').trim() : '';
      const classCell = get(idx.class);
      if (!classCell || !looksLikeCourseCode(classCell)) continue;
      const entry = buildScheduleEntry(classCell, get(idx.days), get(idx.time), get(idx.location));
      if (entry) classes.push(entry);
    }
    return classes;
  }

  /**
   * Scrapes the schedule table on the student dashboard (the page you see right after
   * login: Class, Days, Time, Delivery, Location, Campus, Credits).
   * Tries the known MyRed structure first, then header-based parsing, then positional fallback.
   * @returns {Array<object>} Parsed schedule entries
   */
  function scrapeDashboardSchedule() {
    const myRedClasses = scrapeMyRedScheduleTable();
    if (myRedClasses.length > 0) return myRedClasses;

    const classes = [];
    const seen = new Set();

    function addEntry(entry) {
      const key = (entry.course_code || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      classes.push(entry);
    }

    const tables = document.querySelectorAll('table, [role="grid"]');

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr, [role="row"]'));
      if (rows.length < 2) continue;

      let headerRow = null;
      let headerTexts = [];

      for (const row of rows) {
        const cells = row.querySelectorAll('th, td, [role="columnheader"], [role="gridcell"]');
        const texts = Array.from(cells).map(c => (c.textContent || '').trim().toLowerCase());
        const joined = texts.join(' ');
        if (joined.includes('class') && joined.includes('days') && joined.includes('time') && texts.length >= 4) {
          headerRow = row;
          headerTexts = texts;
          break;
        }
      }

      if (headerRow && headerTexts.length) {
        const idx = {
          class: headerTexts.findIndex(h => h === 'class' || (h && h.includes('class') && !h.includes('campus'))),
          days: headerTexts.findIndex(h => h === 'days' || (h && h.includes('days'))),
          time: headerTexts.findIndex(h => h === 'time' || (h && h.includes('time'))),
          location: headerTexts.findIndex(h => h === 'location' || (h && h.includes('location'))),
        };
        if (idx.class >= 0) {
          for (const row of rows) {
            if (row === headerRow) continue;
            const cells = row.querySelectorAll('td, [role="gridcell"], th');
            if (cells.length < 3) continue;
            const get = (i) => (i >= 0 && cells[i]) ? (cells[i].textContent || '').trim() : '';
            const classCell = get(idx.class);
            const days = get(idx.days);
            const timeRaw = get(idx.time);
            const locationRaw = get(idx.location);
            if (!classCell || classCell.toLowerCase() === 'class') continue;
            if (!looksLikeCourseCode(classCell)) continue;
            const entry = buildScheduleEntry(classCell, days, timeRaw, locationRaw);
            if (entry) addEntry(entry);
          }
          if (classes.length > 0) return classes;
        }
      }

      for (const row of rows) {
        const cells = row.querySelectorAll('td, [role="gridcell"], th');
        if (cells.length < 4) continue;
        const get = (i) => (i < cells.length && cells[i]) ? (cells[i].textContent || '').trim() : '';
        const c0 = get(0);
        if (!looksLikeCourseCode(c0)) continue;
        const days = get(1);
        const timeRaw = get(2);
        const locationRaw = get(4) || get(3);
        const entry = buildScheduleEntry(c0, days, timeRaw, locationRaw);
        if (entry) addEntry(entry);
      }

      if (classes.length > 0) return classes;
    }

    const anyRow = document.querySelectorAll('tr, [role="row"]');
    for (const row of anyRow) {
      const cells = row.querySelectorAll('td, [role="gridcell"], th');
      if (cells.length < 4) continue;
      const first = (cells[0] && cells[0].textContent || '').trim();
      if (!looksLikeCourseCode(first)) continue;
      const entry = buildScheduleEntry(first, (cells[1] && cells[1].textContent || '').trim(), (cells[2] && cells[2].textContent || '').trim(), (cells[4] && cells[4].textContent || '').trim() || (cells[3] && cells[3].textContent || '').trim());
      if (entry) addEntry(entry);
    }

    return classes;
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

    if (isDashboardSchedulePage()) {
      const dashboardClasses = scrapeDashboardSchedule();
      if (dashboardClasses.length > 0) {
        return dashboardClasses;
      }
    }

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

    // Fallback: user's personal class list (enrollment list page SSR_SSENRL_LIST)
    if (classes.length === 0 && isEnrollmentListPage()) {
      classes.push(...scrapeEnrollmentList());
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
   * Scrapes the user's personal class list from the enrollment list page (SSR_SSENRL_LIST).
   * This page shows enrolled courses in a list/table; columns vary but often include
   * Subject, Catalog Nbr, Section, Course Title, and sometimes meeting time/location.
   * @returns {Array<object>} Parsed class entries (course_code, course_title, etc.)
   */
  function scrapeEnrollmentList() {
    const classes = [];
    const tables = document.querySelectorAll('.datadisplaytable, table.PSLEVEL1GRID, .ps_grid-body');

    for (const table of tables) {
      const firstRowWithTh = table.querySelector('thead tr, tr');
      const headerCells = firstRowWithTh ? firstRowWithTh.querySelectorAll('th, .ps_grid-cell') : [];
      const headerTexts = Array.from(headerCells).length ? Array.from(headerCells).map(c => (c.textContent || '').trim().toLowerCase()) : [];

      // Find column indices by common enrollment list headers
      const idx = {
        subject: headerTexts.findIndex(h => h.includes('subject') || h === 'subject'),
        catalog: headerTexts.findIndex(h => h.includes('catalog') || h.includes('course')),
        section: headerTexts.findIndex(h => h.includes('section')),
        title: headerTexts.findIndex(h => h.includes('title') || h.includes('course title')),
        time: headerTexts.findIndex(h => h.includes('time') || h.includes('meeting')),
        days: headerTexts.findIndex(h => h.includes('days')),
        where: headerTexts.findIndex(h => h.includes('where') || h.includes('location') || h.includes('room')),
        instructor: headerTexts.findIndex(h => h.includes('instructor')),
      };

      const rows = table.querySelectorAll('tbody tr, tr.ps_grid-row, .datadisplaytable tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td, .ps_grid-cell');
        if (cells.length < 2) continue;

        const get = (i) => (i >= 0 && cells[i]) ? cells[i].textContent.trim() : '';

        // Build course code: Subject + Catalog (e.g. "CSCE 361") and section
        const subject = get(idx.subject);
        const catalog = get(idx.catalog);
        const section = get(idx.section);
        const title = get(idx.title);
        const timeRaw = get(idx.time);
        const days = get(idx.days);
        const where = get(idx.where);
        const instructor = get(idx.instructor);

        let courseCode = '';
        if (subject || catalog) {
          courseCode = [subject, catalog].filter(Boolean).join(' ');
          if (section) courseCode += ' - ' + section;
        }
        if (!courseCode && cells.length >= 2) {
          courseCode = get(0) || get(1);
        }
        if (!courseCode && !title) continue;

        const timeParts = timeRaw ? timeRaw.split('-').map(s => s.trim()) : [];
        let building = '';
        let room = '';
        if (where) {
          const whereMatch = where.match(/^(.+?)\s+(\S+)\s*$/);
          if (whereMatch) {
            building = whereMatch[1].trim();
            room = whereMatch[2].trim();
          } else {
            building = where;
          }
        }

        classes.push({
          course_code: courseCode,
          course_title: title || courseCode,
          days: days || '',
          start_time: timeParts.length >= 2 ? convertTo24Hour(timeParts[0]) : null,
          end_time: timeParts.length >= 2 ? convertTo24Hour(timeParts[1]) : null,
          time_raw: timeRaw || '',
          building,
          room,
          instructor: instructor ? instructor.replace(/\s*\(P\)\s*/g, '').trim() : '',
        });
      }
    }

    // Fallback: any datadisplaytable with rows that look like course rows (e.g. "CSCE 361" pattern)
    if (classes.length === 0) {
      const allTables = document.querySelectorAll('.datadisplaytable');
      for (const table of allTables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td.dddefault, td');
          if (cells.length < 2) continue;
          const first = (cells[0]?.textContent || '').trim();
          const second = (cells[1]?.textContent || '').trim();
          const courseLike = /^[A-Z]{2,4}\s*\d{3}[A-Z]?$/i.test(first.replace(/\s/g, ' '));
          if (courseLike && second) {
            classes.push({
              course_code: first,
              course_title: second,
              days: (cells[2]?.textContent || '').trim(),
              start_time: null,
              end_time: null,
              time_raw: (cells[3]?.textContent || '').trim(),
              building: (cells[4]?.textContent || '').trim(),
              room: '',
              instructor: (cells[6]?.textContent || '').trim().replace(/\s*\(P\)\s*/g, ''),
            });
          }
        }
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
    const s = timeStr.trim();
    const match = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i) || s.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
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
      background: #3b82f6;
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

  /**
   * Scrapes user identity from the MyRed page (name, NUID).
   * MyRed/PeopleSoft shows the user's name in the header area.
   */
  function scrapeUserIdentity() {
    const identity = { displayName: null, nuid: null, email: null };

    // Try to get name from the greeting/header
    // PeopleSoft typically shows "Welcome, First Last" or the name in a header element
    const selectors = [
      '#PT_GREETING',             // PeopleSoft greeting
      '.PSGROUPBOXLABEL',         // PeopleSoft group box
      '#pthdr2acttxt',            // PeopleSoft header text
      '.PSLONGEDITBOX',           // Name fields
      '#DERIVED_SSS_SCL_SSS_MORE_ACAD_REC_BTN', // Academic link with name
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        // Look for greeting pattern: "Welcome, John Smith" or "John Smith"
        const greetingMatch = text.match(/(?:welcome|hello|hi)[,\s]+(.+)/i);
        if (greetingMatch) {
          identity.displayName = greetingMatch[1].trim();
          break;
        }
        // If it looks like a name (2-3 words, no numbers)
        const nameMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})$/);
        if (nameMatch) {
          identity.displayName = nameMatch[1].trim();
          break;
        }
      }
    }

    // Try to find NUID from the page (8-digit number)
    const bodyText = document.body.innerText || '';
    const nuidMatch = bodyText.match(/(?:NUID|Student\s*ID|ID)[:\s]*(\d{8})/i);
    if (nuidMatch) {
      identity.nuid = nuidMatch[1];
    }

    // Also try the URL for EMPLID (PeopleSoft employee/student ID)
    const urlMatch = window.location.href.match(/EMPLID=(\d{8})/);
    if (urlMatch && !identity.nuid) {
      identity.nuid = urlMatch[1];
    }

    // Try to get from page title
    if (!identity.displayName) {
      const title = document.title || '';
      // PeopleSoft titles sometimes include the user name
      const titleNameMatch = title.match(/(?:for|of)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      if (titleNameMatch) {
        identity.displayName = titleNameMatch[1];
      }
    }

    return identity;
  }

  /**
   * Scrapes academic profile info from MyRed (major, college, class level).
   * PeopleSoft shows this on multiple pages in various label+value patterns.
   */
  function scrapeAcademicProfile() {
    const profile = { major: null, college: null, classLevel: null };
    const bodyText = document.body.innerText || '';

    // Look for "Plan:" or "Major:" labels (PeopleSoft academic records)
    const majorPatterns = [
      /(?:Plan|Major|Program of Study)[:\s]+([^\n]+)/i,
      /(?:Academic Plan)[:\s]+([^\n]+)/i,
      /(?:Major Description)[:\s]+([^\n]+)/i,
    ];
    for (const pattern of majorPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        profile.major = match[1].trim().substring(0, 200);
        break;
      }
    }

    // Look for college
    const collegePatterns = [
      /(?:College|Academic Group)[:\s]+([^\n]+)/i,
      /(?:School)[:\s]+([^\n]+)/i,
    ];
    for (const pattern of collegePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        profile.college = match[1].trim().substring(0, 200);
        break;
      }
    }

    // Look for class level (Freshman, Sophomore, Junior, Senior, Graduate)
    const levelMatch = bodyText.match(/(?:Academic Level|Class Standing|Level)[:\s]*(Freshman|Sophomore|Junior|Senior|Graduate|Post-Baccalaureate)/i);
    if (levelMatch) {
      profile.classLevel = levelMatch[1].trim();
    }

    // Also try PeopleSoft table cell pairs (label in one cell, value in next)
    const cells = document.querySelectorAll('td.PSEDITBOX_DISPONLY, td.PSLONGEDITBOX, span.PSEDITBOX_DISPONLY, span.PSLONGEDITBOX');
    for (const cell of cells) {
      const text = cell.textContent.trim();
      if (!profile.major && /^(Computer Science|Engineering|Business|Biology|Chemistry|Physics|Mathematics|Psychology|English|History|Political Science)/i.test(text)) {
        profile.major = text.substring(0, 200);
      }
    }

    return profile;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  function init() {
    // Check if this is a login/SSO redirect page (skip those)
    const url = window.location.href.toLowerCase();
    const isLoginPage = url.includes('/signon') || url.includes('cmd=login') || url.includes('idp/profile') || url.includes('trueyou.unl.edu');

    if (isLoginPage) {
      console.log('[Kampus] MyRed: login/SSO page, skipping scrape.');
      return;
    }

    // We're on a logged-in MyRed page — always send identity
    const identity = scrapeUserIdentity();
    // Even if we didn't find a name/NUID, the fact we're on MyRed means the user is authenticated
    console.log('[Kampus] MyRed: user identity:', identity);
    chrome.runtime.sendMessage({
      type: 'MYRED_USER_DETECTED',
      data: {
        displayName: identity.displayName || 'UNL Student',
        nuid: identity.nuid || null,
        email: identity.email || null,
      },
    });

    // Try to scrape academic profile info on any page
    const profile = scrapeAcademicProfile();
    if (profile.major || profile.college || profile.classLevel) {
      console.log('[Kampus] MyRed: detected academic profile:', profile);
      chrome.runtime.sendMessage({
        type: 'MYRED_PROFILE_SCRAPED',
        data: profile,
      });
    }

    if (!isSchedulePage()) {
      console.log('[Kampus] MyRed: not a schedule page, skipping schedule scrape.');
      return;
    }

    console.log('[Kampus] MyRed: schedule page detected. Scraping...');

    function tryScrapeAndSend() {
      const classes = scrapeClassSchedule();
      if (classes.length > 0) {
        console.log('[Kampus] MyRed: scraped', classes.length, 'classes.');
        sendToBackground(classes);
        return true;
      }
      return false;
    }

    if (isDashboardSchedulePage()) {
      var scrapeAttempts = 0;
      var maxAttempts = 5;
      var attemptDelay = 2500;

      function attemptScrape() {
        scrapeAttempts += 1;
        if (tryScrapeAndSend()) return;
        if (scrapeAttempts < maxAttempts) {
          console.log('[Kampus] MyRed: schedule not ready yet, retry in', attemptDelay / 1000, 's...');
          setTimeout(attemptScrape, attemptDelay);
        } else {
          console.warn('[Kampus] MyRed: could not find schedule table after', maxAttempts, 'attempts.');
        }
      }

      setTimeout(attemptScrape, 1500);

      var observer = new MutationObserver(function () {
        if (tryScrapeAndSend()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { observer.disconnect(); }, 15000);
    } else {
      setTimeout(function () {
        tryScrapeAndSend();
      }, 1000);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
