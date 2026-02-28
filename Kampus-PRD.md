# Kampus — Product Requirements Document

**Version:** 1.0  
**Date:** February 28, 2026  
**Hackathon:** RaikesHacks 2026 — University of Nebraska-Lincoln  
**Target Track:** DineU Delivery (Primary) + Reach Test Prep (Secondary)

---

## 1. Executive Summary

**Kampus** is a Chrome Extension + Web App platform that unifies a UNL student's entire academic and social campus life. The user installs the extension, logs into UNL services normally (Canvas, MyRed, NvolveU) on their own browser, and the extension silently scrapes their data — assignments, class schedules, grades, events — and syncs it to the Kampus backend. No API tokens. No extra logins. No fighting MFA.

The web app then becomes their intelligent campus hub: a smart calendar, AI-powered study planner, location-aware event recommender, social study session platform, and behavioral insights dashboard — all powered by the data the extension continuously collects.

**Tagline:** *"Your campus life, unified. Never miss free food again."*

---

## 2. Problem Statement

UNL students juggle 5+ disconnected platforms daily:

- **Canvas** — assignments, grades, announcements
- **MyRed** — class schedule, enrollment, academic records
- **NvolveU** — student org events, RSO activities
- **UNL Events** — campus-wide events, lectures, career fairs
- **Google Calendar** — personal scheduling

There is no single place where a student can see: "What's due, where am I supposed to be, what's happening nearby, and who else is struggling with the same problem set?" Students miss events, underestimate assignment time, study alone when peers are in the same boat, and — critically — miss free food.

---

## 3. The Proxy Scraping Architecture

### 3.1 How It Works (No API Tokens, No MFA Headaches)

The core innovation is the **Chrome Extension acting as a proxy scraper**. Here is the flow:

```
┌──────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                            │
│                                                              │
│  1. User installs Kampus Chrome Extension                    │
│  2. User logs into Canvas, MyRed, NvolveU normally           │
│     (handles MFA, Duo, everything — it's THEIR browser)      │
│  3. Extension detects authenticated sessions via cookies      │
│  4. Extension opens background tabs / uses fetch()            │
│     with the user's existing cookies to hit:                 │
│       - canvas.unl.edu/api/v1/...                            │
│       - myred.unl.edu/...                                    │
│       - unl.campuslabs.com/engage/...                        │
│  5. Extension extracts structured data                       │
│  6. Extension sends data to Kampus backend via HTTPS          │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   KAMPUS BACKEND                             │
│                                                              │
│  - Receives scraped data from extension                      │
│  - Stores in persistent database                             │
│  - Runs AI analysis (time estimation, pattern detection)     │
│  - Serves the Kampus web app                                 │
│  - Manages social features (study sessions, invites)         │
│  - Pushes to Google Calendar via OAuth                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Why This Works

- **MFA is not a problem.** The user authenticates in their own browser normally. Duo Push, SMS, hardware key — doesn't matter. Once they're logged in, the extension rides on their session cookies.
- **No API tokens to manage.** Canvas has a REST API that responds to session cookies from the browser. The extension makes `fetch()` calls with `credentials: 'include'` — Canvas responds as if the user is browsing normally.
- **Real-time data.** The extension can poll on intervals (every 30 min) or trigger scrapes when the user visits certain pages.
- **Works with ANY UNL service.** If the user can see it in their browser, the extension can extract it.

### 3.3 What the Extension Scrapes

| Source | What to Scrape | How | Frequency |
|--------|---------------|-----|-----------|
| **Canvas** | Courses, assignments (name, due_at, points, description, submission status), grades, announcements | `fetch('https://canvas.unl.edu/api/v1/...')` with session cookies — Canvas has a full REST API accessible via browser | Every 30 min + on page visit |
| **MyRed** | Class schedule (course, section, days, times, building, room) | DOM scraping of the schedule page — parse the HTML table from the "My Class Schedule" page | Once daily + manual refresh |
| **NvolveU** | Upcoming events, RSO events, event details (time, location, description) | Hit internal Engage API or DOM scrape `unl.campuslabs.com/engage/events` | Every 2 hours |
| **Canvas Grades** | Current grades per course, assignment scores, grade history | `fetch('https://canvas.unl.edu/api/v1/courses/:id/enrollments?user_id=self')` | Every 6 hours |

### 3.4 Extension Technical Details

```
kampus-extension/
├── manifest.json          # Manifest V3
├── background.js          # Service worker — orchestrates scraping
├── content-scripts/
│   ├── canvas.js          # Runs on canvas.unl.edu — detects login, triggers scrapes
│   ├── myred.js           # Runs on myred.unl.edu — scrapes class schedule
│   └── nvolveu.js         # Runs on unl.campuslabs.com — scrapes events
├── popup/
│   ├── popup.html         # Quick status view + link to web app
│   └── popup.js
└── utils/
    ├── api.js             # Sends data to Kampus backend
    └── parser.js          # HTML/JSON parsing utilities
```

**manifest.json key permissions:**
```json
{
  "manifest_version": 3,
  "name": "Kampus",
  "permissions": ["storage", "alarms", "tabs", "cookies"],
  "host_permissions": [
    "https://canvas.unl.edu/*",
    "https://myred.unl.edu/*",
    "https://unl.campuslabs.com/*",
    "https://events.unl.edu/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://canvas.unl.edu/*"],
      "js": ["content-scripts/canvas.js"]
    },
    {
      "matches": ["https://myred.unl.edu/*"],
      "js": ["content-scripts/myred.js"]
    },
    {
      "matches": ["https://unl.campuslabs.com/*"],
      "js": ["content-scripts/nvolveu.js"]
    }
  ]
}
```

**Canvas scraping from extension (example):**
```javascript
// background.js — uses the user's existing Canvas session
async function scrapeCanvasAssignments() {
  // This works because the user is logged into Canvas in their browser
  // The fetch inherits their session cookies automatically
  const courses = await fetch('https://canvas.unl.edu/api/v1/courses?enrollment_state=active&per_page=50', {
    credentials: 'include'
  }).then(r => r.json());

  const allAssignments = [];
  for (const course of courses) {
    const assignments = await fetch(
      `https://canvas.unl.edu/api/v1/courses/${course.id}/assignments?per_page=50&order_by=due_at`,
      { credentials: 'include' }
    ).then(r => r.json());

    allAssignments.push(...assignments.map(a => ({
      id: a.id,
      course_id: course.id,
      course_name: course.name,
      name: a.name,
      description: a.description,
      due_at: a.due_at,
      points_possible: a.points_possible,
      submission_types: a.submission_types,
      has_submitted: a.has_submitted_submissions,
      html_url: a.html_url
    })));
  }

  // Send to Kampus backend
  await fetch('https://kampus-api.vercel.app/api/sync/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ assignments: allAssignments })
  });
}
```

**MyRed scraping (content script — DOM parsing):**
```javascript
// content-scripts/myred.js
// This runs when the user visits their MyRed schedule page
// We parse the schedule table from the DOM

function scrapeClassSchedule() {
  // MyRed renders schedule as an HTML table
  const rows = document.querySelectorAll('.datadisplaytable tr');
  const classes = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 7) {
      classes.push({
        course: cells[0]?.textContent.trim(),     // "CSCE 361 - 001"
        title: cells[1]?.textContent.trim(),       // "Software Engineering"
        days: cells[2]?.textContent.trim(),        // "MWF"
        time: cells[3]?.textContent.trim(),        // "2:00 pm - 2:50 pm"
        building: cells[4]?.textContent.trim(),    // "Avery Hall"
        room: cells[5]?.textContent.trim(),        // "115"
        instructor: cells[6]?.textContent.trim()   // "Dr. Smith"
      });
    }
  });

  // Send to background script → backend
  chrome.runtime.sendMessage({
    type: 'SCHEDULE_SCRAPED',
    data: classes
  });
}

// Run when page loads
if (window.location.href.includes('class_schedule')) {
  scrapeClassSchedule();
}
```

---

## 4. Database Schema

Kampus requires a persistent database to track history, patterns, and social connections. Here is the full schema:

### 4.1 Core Tables

```sql
-- Users (linked to UNL identity via extension)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nuid            VARCHAR(8) UNIQUE,           -- UNL student ID
  display_name    VARCHAR(100),
  email           VARCHAR(100),
  avatar_url      TEXT,
  google_id       VARCHAR(100),                -- For Google Calendar OAuth
  google_token    JSONB,                       -- Encrypted Google OAuth tokens
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at    TIMESTAMPTZ,                 -- Last time extension synced data
  settings        JSONB DEFAULT '{}'           -- User preferences
);

-- Courses (from Canvas)
CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id       BIGINT NOT NULL,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200),
  code            VARCHAR(50),                 -- "CSCE 361"
  term            VARCHAR(50),                 -- "Spring 2026"
  current_grade   VARCHAR(5),                  -- "A-", "B+", etc.
  current_score   DECIMAL(5,2),                -- 92.5
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canvas_id, user_id)
);

-- Assignments (from Canvas — historical tracking)
CREATE TABLE assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id       BIGINT NOT NULL,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(500),
  description     TEXT,
  due_at          TIMESTAMPTZ,
  points_possible DECIMAL(8,2),
  submission_types TEXT[],                     -- {"online_upload", "online_text_entry"}
  has_submitted   BOOLEAN DEFAULT FALSE,
  score           DECIMAL(8,2),               -- Grade received (NULL if not graded)
  submitted_at    TIMESTAMPTZ,                -- When user submitted
  estimated_hours DECIMAL(4,1),               -- AI-estimated time
  actual_hours    DECIMAL(4,1),               -- User-reported time (for pattern learning)
  html_url        TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canvas_id, user_id)
);

-- Class Schedule (from MyRed)
CREATE TABLE class_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  course_code     VARCHAR(50),                -- "CSCE 361 - 001"
  course_title    VARCHAR(200),               -- "Software Engineering"
  days            VARCHAR(10),                -- "MWF", "TR"
  start_time      TIME,                       -- 14:00
  end_time        TIME,                       -- 14:50
  building        VARCHAR(100),               -- "Avery Hall"
  room            VARCHAR(20),                -- "115"
  building_lat    DECIMAL(9,6),               -- 40.8194
  building_lng    DECIMAL(9,6),               -- -96.7056
  instructor      VARCHAR(100),
  term            VARCHAR(50),                -- "Spring 2026"
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Grade History (track grade changes over time for pattern analysis)
CREATE TABLE grade_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES assignments(id),
  score           DECIMAL(8,2),
  points_possible DECIMAL(8,2),
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Events & Location Tables

```sql
-- Events (aggregated from UNL Events + NvolveU)
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          VARCHAR(20) NOT NULL,       -- 'unl_events', 'nvolveu'
  source_id       VARCHAR(100),               -- ID from source system
  title           VARCHAR(500),
  description     TEXT,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  building        VARCHAR(100),
  room            VARCHAR(50),
  address         TEXT,
  lat             DECIMAL(9,6),
  lng             DECIMAL(9,6),
  has_free_food   BOOLEAN DEFAULT FALSE,      -- Detected by AI/keyword scan
  food_details    TEXT,                        -- "Free pizza", "Lunch provided"
  event_type      VARCHAR(50),                -- 'career', 'social', 'academic', 'sports'
  org_name        VARCHAR(200),               -- Hosting organization
  event_url       TEXT,
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)
);

-- Campus Buildings (reference table with coordinates)
CREATE TABLE campus_buildings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) UNIQUE,        -- "Avery Hall"
  short_name      VARCHAR(20),                -- "AVRY"
  lat             DECIMAL(9,6) NOT NULL,
  lng             DECIMAL(9,6) NOT NULL,
  address         TEXT
);

-- User Location Log (predicted/inferred location based on class schedule)
CREATE TABLE location_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  building_id     UUID REFERENCES campus_buildings(id),
  source          VARCHAR(20),                -- 'class_schedule', 'manual_checkin', 'event_rsvp'
  arrived_at      TIMESTAMPTZ,
  departed_at     TIMESTAMPTZ,
  day_of_week     SMALLINT                    -- 0=Sun, 1=Mon, ...
);

-- Walking History (estimated transit between buildings)
CREATE TABLE walking_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  from_building   UUID REFERENCES campus_buildings(id),
  to_building     UUID REFERENCES campus_buildings(id),
  departed_at     TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  distance_meters INT,                        -- Estimated walking distance
  duration_minutes DECIMAL(4,1)               -- Estimated walking time
);
```

### 4.3 Social & Study Session Tables

```sql
-- Study Sessions (core social feature)
CREATE TABLE study_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200),               -- "CSCE 361 Midterm Prep"
  description     TEXT,
  course_id       UUID REFERENCES courses(id),
  assignment_id   UUID REFERENCES assignments(id),  -- Optional: specific assignment
  building        VARCHAR(100),
  room            VARCHAR(50),
  lat             DECIMAL(9,6),
  lng             DECIMAL(9,6),
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  max_participants INT DEFAULT 10,
  is_public       BOOLEAN DEFAULT TRUE,       -- Visible to all Kampus users
  status          VARCHAR(20) DEFAULT 'upcoming',  -- 'upcoming', 'active', 'completed', 'cancelled'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Study Session Participants
CREATE TABLE session_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'invited',  -- 'invited', 'accepted', 'declined', 'attended'
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  UNIQUE(session_id, user_id)
);

-- Smart Matching: Users sharing the same courses/assignments
-- (Used to suggest "others in the same boat" for study sessions)
CREATE TABLE user_course_links (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  canvas_course_id BIGINT,                    -- For cross-user matching
  PRIMARY KEY(user_id, course_id)
);

-- Social Connections (friends/study buddies)
CREATE TABLE connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'accepted', 'blocked'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, receiver_id)
);

-- Activity Feed (social platform backbone)
CREATE TABLE feed_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,       -- 'session_created', 'session_joined',
                                              -- 'assignment_completed', 'streak_achieved',
                                              -- 'free_food_spotted', 'study_invite'
  data            JSONB,                      -- Flexible payload
  visibility      VARCHAR(20) DEFAULT 'friends',  -- 'public', 'friends', 'private'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL,       -- 'session_invite', 'free_food_nearby',
                                              -- 'assignment_due_soon', 'study_reminder',
                                              -- 'event_recommendation', 'friend_request'
  title           VARCHAR(200),
  body            TEXT,
  data            JSONB,                      -- Deep link data
  read            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 Behavioral Analytics Tables

```sql
-- Assignment Behavior Tracking
CREATE TABLE assignment_behavior (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  assignment_id   UUID REFERENCES assignments(id),
  first_viewed_at TIMESTAMPTZ,                -- When extension first detected user viewing
  started_at      TIMESTAMPTZ,                -- When user self-reports starting
  submitted_at    TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  days_before_due DECIMAL(4,1),               -- How many days early they started
  estimated_hours DECIMAL(4,1),
  actual_hours    DECIMAL(4,1),
  procrastination_score DECIMAL(3,2)          -- 0.0 (early bird) to 1.0 (last minute)
);

-- Weekly Behavioral Summaries
CREATE TABLE weekly_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE,
  total_assignments_due INT,
  assignments_completed INT,
  avg_days_before_due DECIMAL(4,1),
  total_study_hours DECIMAL(5,1),
  study_sessions_attended INT,
  events_attended INT,
  free_food_events INT,                       -- The important metric
  campus_buildings_visited INT,
  ai_summary      TEXT,                       -- LLM-generated weekly recap
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Study Streaks (gamification)
CREATE TABLE streaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(30),                -- 'daily_study', 'on_time_submission', 'social_study'
  current_count   INT DEFAULT 0,
  longest_count   INT DEFAULT 0,
  last_activity   DATE,
  started_at      DATE
);
```

---

## 5. Feature Specifications

### 5.1 F1 — Smart Calendar (Unified View)

**Description:** A single calendar view combining class schedule, assignments, events, and study sessions. Color-coded by type.

**Data Sources:** class_schedule + assignments + events + study_sessions

**Color Coding:**
- 🔵 Blue — Classes (from MyRed)
- 🔴 Red — Assignments due (from Canvas)
- 🟢 Green — Events (from UNL Events / NvolveU)
- 🟡 Yellow — Study Sessions (social)
- 🍕 Orange — Free Food Events (special highlight)

**AI Enhancement:** Automatically inserts "study blocks" into empty calendar slots, working backwards from assignment due dates. Uses estimated hours to determine block size.

**Google Calendar Sync:** Two-way sync via Google Calendar API. User authenticates with Google OAuth once, then all items push/pull automatically.

### 5.2 F2 — AI Assignment Time Estimation

**Description:** For each assignment scraped from Canvas, an LLM estimates how many hours the student should allocate.

**Inputs to the LLM:**
- Assignment name and description
- Points possible
- Course name and type (CS, humanities, math, etc.)
- Submission type (essay, code, quiz, etc.)
- User's historical data: how long similar assignments took before
- User's current grade in the course (higher stakes if grade is borderline)

**Prompt Template:**
```
You are an academic advisor. Given the following assignment, estimate how many 
hours a typical student should spend on it. Consider difficulty, scope, and 
the student's past performance.

Assignment: {name}
Course: {course_name}
Description: {description (first 500 chars)}
Points: {points_possible}
Type: {submission_types}
User's past average for this course: {avg_hours_similar}
User's current grade: {current_score}%

Respond with ONLY a JSON object: {"hours": <number>, "reasoning": "<1 sentence>"}
```

**Output:** Stored in `assignments.estimated_hours`. Displayed on the calendar as block duration. Over time, compared against `actual_hours` to improve accuracy.

### 5.3 F3 — Location-Aware Event Recommendations

**Description:** Using the class schedule, Kampus knows where the student is (or will be) on campus at any given time. It recommends events that are nearby and temporally relevant.

**Algorithm:**
```
1. Get user's current/next class from class_schedule
2. Look up building coordinates from campus_buildings
3. Query events happening within next 2 hours
4. Calculate walking distance from user's building to event building
5. Filter: only show events within 10-minute walk (≈800m)
6. Rank by: proximity × time_fit × relevance × free_food_bonus
7. Free food events get 3x weight in ranking
```

**Free Food Detection:**
Scan event `title` and `description` for keywords:
```
FOOD_KEYWORDS = [
  'free food', 'free pizza', 'free lunch', 'free dinner', 'free breakfast',
  'lunch provided', 'dinner provided', 'refreshments', 'food will be served',
  'complimentary food', 'free snacks', 'pizza', 'catering', 'free meal',
  'food and drinks', 'snacks provided', 'free tacos', 'free BBQ',
  'come for the food', 'treats', 'donuts', 'cookies provided'
]
```
Also use LLM as a fallback for ambiguous descriptions.

**Fun "Skip Class?" Feature:**
When a free food event overlaps with a class:
```
🍕 ALERT: "Women in STEM Mixer" has FREE PIZZA at Kauffman Hall
   📍 3 min walk from your next class
   ⏰ Overlaps with CSCE 361 (2:00-2:50 PM)
   
   [Go to Event] [Stay in Class] [Remind Me After Class]
   
   "We're kidding about skipping class... unless? 😏"
```

### 5.4 F4 — Study Sessions (Social Feature)

**Description:** Users can create study sessions for specific courses or assignments and invite others who share the same class.

**Session Creation Flow:**
```
1. User clicks "Create Study Session"
2. Selects course (auto-populated from their Canvas courses)
3. Optionally selects specific assignment
4. Picks time, location (suggest campus buildings they frequent)
5. Sets max participants
6. Publishes — visible to all Kampus users in the same course
```

**Smart Matching ("Others in the Same Boat"):**
- Query `user_course_links` to find all users sharing the same `canvas_course_id`
- Filter to users who haven't submitted the assignment yet
- Sort by proximity (users with similar class schedules likely nearby)
- Show: "12 other students haven't started the CSCE 361 midterm project yet. Create a study session?"

**Session Features:**
- Real-time participant count
- Chat/messaging within session (simple WebSocket chat)
- "I'm running late" status
- Post-session: "Rate this session" for future matching
- Auto-creates a feed item: "Alex created a study session for CSCE 361"

**Invitation System:**
- **Public sessions:** Visible on the Kampus events feed; anyone in the course can join
- **Private sessions:** Invite specific friends/connections
- **Smart invites:** "Invite people who are near [building] right now" — uses predicted location

### 5.5 F5 — Social Platform (Feed & Connections)

**Description:** A lightweight social layer that keeps students connected through their academic journey.

**Activity Feed:**
Shows items from friends and public activity:
- "🎓 Mia completed all MATH 208 assignments this week!"
- "📚 Jake created a study session for CSCE 361 — 4 spots left"
- "🍕 FREE FOOD: Pizza at Nebraska Union, reported by 3 students"
- "🔥 Sarah is on a 7-day study streak!"
- "✅ 15 students just submitted the ENGR 100 lab report"

**Connection System:**
- Send/accept friend requests
- View friends' (anonymized) study patterns: "Your friend group averages 12 study hours/week"
- Share study sessions with friends
- See who's studying at the same building right now

**Privacy Controls:**
- Toggle visibility: public / friends only / private
- Never share exact grades — only relative performance ("ahead of pace" / "on track" / "falling behind")
- Opt-out of location sharing
- Anonymize all data in aggregate views

### 5.6 F6 — Behavioral Insights Dashboard

**Description:** A personal analytics page showing the student their own patterns.

**Metrics Tracked:**
- **Procrastination Index:** Average days before deadline that assignments are started
- **Study Time Distribution:** Hours per course per week (bar chart)
- **Grade Trend:** Line chart of assignment scores over time per course
- **Campus Heatmap:** Which buildings you spend the most time in
- **Walking Stats:** Total distance walked between buildings per week
- **Social Study Score:** Hours in group study vs. solo study
- **Free Food Score:** Events with free food attended this semester 🍕
- **Streak Tracker:** Consecutive days of studying / on-time submissions

**AI Weekly Summary (generated every Sunday):**
```
"This week you completed 5 of 7 assignments on time. You spent 
the most time on CSCE 361 (8.5 hours) and the least on ENGL 150 
(1.2 hours). You started assignments an average of 2.3 days before 
the deadline — up from 1.8 days last week! You attended 2 events, 
both of which had free food. Keep it up! 🔥"
```

### 5.7 F7 — Smart Notifications

**Notification Types:**
| Type | Trigger | Example |
|------|---------|---------|
| Assignment Due | 48h, 24h, 6h, 1h before due | "CSCE 361 Lab 5 due in 6 hours. Estimated: 3h remaining." |
| Free Food Nearby | Event with food within 10min walk | "🍕 Free pizza at Kauffman in 20 min, 4 min walk away" |
| Study Session Invite | Someone creates session for your course | "Maria started a MATH 208 study group at Love Library" |
| Grade Posted | New grade detected on Canvas | "You got 92/100 on CSCE 361 Lab 4! Course grade: A-" |
| Behavioral Nudge | Pattern detected | "You usually start CSCE homework 1 day late. Start today?" |
| Event Recommendation | Relevant event matches profile | "Career Fair tomorrow at Coliseum — 12 CS companies attending" |
| Weekly Summary | Every Sunday | "Your weekly Kampus recap is ready!" |

---

## 6. Tech Stack

### 6.1 Chrome Extension
- **Manifest V3** (required for Chrome Web Store)
- **Vanilla JavaScript** (keep it lightweight — no framework needed in extension)
- **Chrome APIs:** storage, alarms, tabs, cookies, runtime messaging
- **Content Scripts:** For DOM scraping on MyRed and NvolveU
- **Background Service Worker:** For scheduled scraping and API calls

### 6.2 Web App (Frontend)
- **Next.js 14+ (App Router)** with TypeScript
- **Tailwind CSS** + **shadcn/ui** for rapid, polished UI
- **React Big Calendar** or **FullCalendar** for the calendar view
- **Recharts** for behavioral analytics charts
- **Leaflet.js** + OpenStreetMap for campus maps (no API key needed)
- **Socket.io** client for real-time study session chat

### 6.3 Backend
- **Next.js API Routes** (monolithic for hackathon speed)
- **PostgreSQL** on **Supabase** (free tier: 500MB DB, realtime subscriptions, auth)
  - Alternative: **Neon** (serverless Postgres, free tier)
- **Prisma ORM** for database access
- **Socket.io** server for real-time features (study session chat, live notifications)

### 6.4 AI Layer
- **Anthropic Claude API** (or OpenAI GPT-4) for:
  - Assignment time estimation
  - Free food detection in event descriptions
  - Weekly behavioral summaries
  - Event relevance scoring
- Use the **$100 AI credits from the Creevo track** if you can register for it too

### 6.5 Auth & External APIs
- **Supabase Auth** (or NextAuth.js) for app login — email/password or Google OAuth
- **Google Calendar API** via OAuth 2.0 for calendar sync
- **UNL Events API v2** — direct server-side calls, no auth needed for public data

### 6.6 Deployment
- **Vercel** — frontend + API routes (free tier)
- **Supabase** — database + auth + realtime (free tier)
- **Chrome Extension** — load unpacked for hackathon demo; publish to Chrome Web Store later

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐            │
│  │   Canvas     │    │   MyRed      │    │   NvolveU    │            │
│  │ (logged in)  │    │ (logged in)  │    │ (logged in)  │            │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘            │
│         │                   │                    │                    │
│  ┌──────▼───────────────────▼────────────────────▼──────┐            │
│  │              KAMPUS CHROME EXTENSION                   │            │
│  │  • Content scripts scrape DOM                         │            │
│  │  • fetch() with session cookies for Canvas API        │            │
│  │  • Background worker on 30-min alarm cycle            │            │
│  │  • Sends structured JSON to backend                   │            │
│  └──────────────────────────┬────────────────────────────┘            │
│                             │ HTTPS POST                             │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      KAMPUS BACKEND (Vercel + Supabase)             │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Next.js API      │  │  AI Layer     │  │  Realtime Engine   │    │
│  │  Routes           │  │  (Claude API) │  │  (Supabase         │    │
│  │                   │  │               │  │   Realtime /       │    │
│  │  /api/sync/*      │  │  • Time est.  │  │   Socket.io)       │    │
│  │  /api/events/*    │  │  • Food detect│  │                    │    │
│  │  /api/sessions/*  │  │  • Summaries  │  │  • Study chat      │    │
│  │  /api/social/*    │  │  • Matching   │  │  • Live notifs     │    │
│  │  /api/calendar/*  │  │               │  │  • Event updates   │    │
│  └────────┬─────────┘  └───────────────┘  └────────────────────┘    │
│           │                                                          │
│  ┌────────▼──────────────────────────────────────────────────┐      │
│  │                    PostgreSQL (Supabase)                    │      │
│  │  users | courses | assignments | class_schedule | events   │      │
│  │  study_sessions | connections | feed_items | notifications │      │
│  │  grade_history | location_log | walking_history | streaks  │      │
│  │  assignment_behavior | weekly_summaries                    │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌──────────────────┐  ┌─────────────────┐                         │
│  │  UNL Events API  │  │  Google Calendar │                         │
│  │  (server-side     │  │  API (OAuth 2.0) │                         │
│  │   direct calls)   │  │                  │                         │
│  └──────────────────┘  └─────────────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      KAMPUS WEB APP (Next.js on Vercel)             │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Dashboard │ │ Calendar │ │  Events  │ │  Study   │ │ Insights │ │
│  │          │ │          │ │  + Food  │ │ Sessions │ │ + Social │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. UNL Campus Building Coordinates (Seed Data)

Pre-populate the `campus_buildings` table with key buildings:

| Building | Lat | Lng | Common Use |
|----------|-----|-----|------------|
| Avery Hall | 40.8194 | -96.7056 | CS/CE classes |
| Kauffman Academic Center | 40.8187 | -96.7069 | Raikes School |
| Nebraska Union | 40.8186 | -96.7003 | Student center, food, events |
| Love Library | 40.8186 | -96.7022 | Main library, study space |
| Hamilton Hall | 40.8201 | -96.7041 | Math, sciences |
| Burnett Hall | 40.8185 | -96.7042 | Psychology |
| Andrews Hall | 40.8181 | -96.7022 | English, humanities |
| Henzlik Hall | 40.8210 | -96.7014 | Education |
| City Campus Union | 40.8186 | -96.7003 | Food court, events |
| East Campus Union | 40.8316 | -96.6653 | East campus hub |
| Rec Center | 40.8204 | -96.6985 | Recreation |

Walking speed estimate: **5 km/h** → 1 minute ≈ 83 meters.

---

## 9. API Endpoint Design (Backend)

### 9.1 Sync Endpoints (Extension → Backend)

```
POST /api/sync/assignments      — Bulk upsert assignments from Canvas
POST /api/sync/courses          — Bulk upsert courses from Canvas
POST /api/sync/schedule         — Upsert class schedule from MyRed
POST /api/sync/grades           — Update grades from Canvas
POST /api/sync/nvolveu-events   — Upsert events from NvolveU
```

### 9.2 Data Endpoints (Web App)

```
GET  /api/calendar              — Unified calendar (classes + assignments + events + sessions)
GET  /api/events/nearby         — Location-aware event recommendations
GET  /api/events/free-food      — Free food events, ranked by proximity
GET  /api/assignments/upcoming  — Upcoming assignments with AI time estimates
GET  /api/insights/weekly       — Weekly behavioral summary
GET  /api/insights/patterns     — Procrastination index, study patterns, etc.
```

### 9.3 Social Endpoints

```
POST /api/sessions              — Create study session
GET  /api/sessions              — List sessions for user's courses
POST /api/sessions/:id/join     — Join a study session
POST /api/sessions/:id/invite   — Invite users to session
GET  /api/sessions/:id/chat     — WebSocket upgrade for session chat

GET  /api/social/feed           — Activity feed
POST /api/social/connect        — Send friend request
PUT  /api/social/connect/:id    — Accept/decline friend request
GET  /api/social/people         — "People in your courses" discovery
GET  /api/social/same-boat      — Users sharing same upcoming assignment
```

### 9.4 Google Calendar

```
GET  /api/gcal/auth             — Initiate Google OAuth flow
GET  /api/gcal/callback         — OAuth callback
POST /api/gcal/sync             — Push all items to Google Calendar
```

---

## 10. Hackathon Execution Plan

### Team Role Suggestions (3-4 people)

| Role | Person | Responsibilities |
|------|--------|-----------------|
| **Extension Dev** | Person 1 | Chrome extension, scraping logic, content scripts, data parsing |
| **Backend Dev** | Person 2 | Database schema, API routes, AI integration, Google Calendar |
| **Frontend Dev** | Person 3 | Web app UI, calendar view, dashboard, notifications |
| **Full-stack/Design** | Person 4 | Social features, study sessions, UI polish, demo prep |

### Timeline

| Phase | Hours | Tasks |
|-------|-------|-------|
| **Infra Setup** | 0–2 | Scaffold Next.js, Supabase DB, Chrome extension boilerplate, `.env` config |
| **Extension Core** | 2–6 | Canvas scraper (fetch API), MyRed DOM parser, NvolveU scraper, background sync loop |
| **Backend Core** | 2–6 | DB schema + Prisma, sync endpoints, UNL Events server-side fetcher |
| **Frontend Core** | 4–10 | Dashboard layout, calendar view with FullCalendar, event cards |
| **AI Features** | 8–12 | Time estimation prompt, free food detection, event ranking |
| **Social Features** | 10–16 | Study sessions CRUD, "same boat" matching, invitations, activity feed |
| **Google Calendar** | 12–16 | OAuth flow, push events, color coding |
| **Location Engine** | 14–18 | Building coords, proximity calculator, campus map view |
| **Insights & Analytics** | 16–20 | Behavioral charts, procrastination index, weekly summary |
| **Polish & Fun** | 18–22 | "Skip class?" modal, free food banner, streaks, animations |
| **Demo Prep** | 22–24 | Practice pitch, record backup video, edge case handling |

---

## 11. Demo Script for Judges

### Scene 1: Setup (30 seconds)
"Meet Kampus. Install the Chrome extension, and it works with the UNL accounts you're already logged into. No API keys, no extra passwords."

*Show: Extension icon → green badge showing "synced"*

### Scene 2: The Dashboard (45 seconds)
"Here's everything in one place. My classes from MyRed, assignments from Canvas with AI-estimated study time, campus events, and study sessions — all on one calendar."

*Show: Color-coded calendar with class blocks, assignment deadlines, and events*

### Scene 3: The Free Food Alert (30 seconds)
"Kampus scans every event for free food. Right now, there's free pizza at Kauffman Hall — and it's a 3-minute walk from my next class."

*Show: Free food banner with 🍕 emoji, distance, and the fun "skip class?" prompt*

### Scene 4: Study Sessions — Social Feature (45 seconds)
"I have a CSCE 361 midterm next week. Kampus found 14 other students who haven't started studying either. I created a study session — here's who joined."

*Show: Create session → see others in the same course → 3 people join live*

### Scene 5: Behavioral Insights (30 seconds)
"Kampus tracks my patterns. I start assignments 1.8 days before the deadline, I spend the most time in Avery Hall, and I've attended 4 free food events this month."

*Show: Charts, procrastination index, campus heatmap*

### Scene 6: The Pitch (15 seconds)
"Kampus: your campus life, unified. Built by students, for students. Never miss free food again."

---

## 12. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Canvas `fetch()` from extension doesn't work with session cookies | Low (it's documented behavior) | Critical | Test immediately; fallback: ask user for Canvas access token as backup |
| MyRed DOM structure changes or is hard to parse | Medium | Medium | Have a manual schedule input form as fallback; focus demo on Canvas data |
| NvolveU blocks extension requests | Medium | Low | UNL Events API (no auth) covers most events; NvolveU is bonus |
| Supabase free tier limits hit | Low | Medium | SQLite local fallback for demo |
| LLM API goes down during demo | Low | Medium | Cache all AI responses; pre-generate demo data |
| Extension rejected from Chrome Web Store | N/A for hackathon | None | Load unpacked for demo; store publishing is post-hackathon |
| Privacy concerns from judges | Medium | Medium | Emphasize: data stays in user's control, opt-in everything, no data shared without consent |

---

## 13. Post-Hackathon Vision

If Kampus wins or gains traction:

1. **Mobile App** — React Native, with push notifications for free food alerts
2. **Multi-university Support** — Any school using Canvas + CampusLabs Engage (400+ universities)
3. **Real Location Tracking** — Opt-in GPS/Bluetooth for actual (not predicted) location
4. **Professor Ratings Integration** — RateMyProfessor data in course views
5. **AI Study Buddy** — RAG-based chatbot that answers questions using your course materials
6. **Marketplace** — Students selling/sharing notes, textbooks, study guides
7. **Partnership with DineU** — Integrate food delivery when no free food is nearby 😄

---

*Kampus — Your campus life, unified. Never miss free food again. 🍕*
