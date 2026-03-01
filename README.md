# 🎓 Kampus - Your Campus Life, Unified

**Kampus** is a full-stack student productivity platform built for UNL students. It integrates Canvas grades, MyRed schedule, NvolveU campus events, and Google Calendar into a single dashboard. An AI layer (OpenAI GPT-4o) analyzes behavioral patterns - procrastination, burnout risk, and study style and proactively surfaces actionable interventions. Helps students to improve their study workflows and actively improve their learning.

## Features

### Dashboard
- Unified view of classes, assignments, events, and study sessions
- Real-time free food alerts
- Course grade tracking (synced from Canvas via extension)

### Calendar
- Monthly calendar with all event types
- Google Calendar two-way sync
- **Perfect My Schedule** — AI-powered schedule optimizer (detects overlaps, injects Focus Time blocks before deadlines, syncs improvements to Google Calendar)

### Insights & Behavioral Analytics
- Behavioral profile detection (Social Learner, Solo Grinder, etc.)
- Procrastination Index (tracks how close to deadlines you submit work)
- Burnout risk trend chart (calculated from study hours + event data)
- Grade trajectory analysis
- AI-generated recommendations

### Events
- Pulls campus events from NvolveU
- Free food filter and alerts
- Add events directly to Google Calendar

### Social
- Social feed of classmate activity
- Connection requests
- "People in Your Courses" — discover classmates

### Study Sessions
- Create and join collaborative study sessions
- Real-time group chat
- Integrated with Google Calendar

## Quick Start - Local Development (No Docker)

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20.x |
| npm | ≥ 10.x |
| PostgreSQL | ≥ 15 (local or cloud) |

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Kampus
```

### 2. Set up environment variables

```bash
cp web/.env.example web/.env   # if .env.example exists, otherwise create from scratch
```

Open `web/.env` and fill in all values (see **Environment Variables** section below).

### 3. Install dependencies

```bash
cd web
npm i
```

### 4. Apply database migrations

```bash
npx prisma migrate deploy
# Or for dev (creates migration files):
npx prisma migrate dev --name init
```

### 5. Start the development server

```bash
npm run dev # within web directory
```

The app will be available at **http://localhost:3000**.


## Docker Deployment

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20

### 1. Create a `.env` file at the repository root

```bash
cp web/.env web/.env.docker   # or create from scratch
```

The `docker-compose.yml` reads from a `.env` file in the **same directory as the compose file** (the repo root). Create `/Kampus/.env`:

```env
# ---- Database ----
DATABASE_URL=postgresql://kampusadmin:KampusLocal2026!@db:5432/kampus

# ---- Auth ----
JWT_SECRET=your-super-secret-jwt-key-change-this

# ---- Google OAuth ----
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ---- App URL ----
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ---- AI ----
OPENAI_API_KEY=sk-proj-...

# ---- Postgres root password (used by db service) ----
POSTGRES_PASSWORD=KampusLocal2026!
```

> **Note:** When using the bundled Postgres service, `DATABASE_URL` must use `@db:5432` (the Docker service name), **not** `localhost`.

### 2. Enable Next.js standalone output

Open `web/next.config.ts` (or `next.config.js`) and ensure this is set:

```js
const nextConfig = {
  output: 'standalone',
  // ... other config
};
```

### 3. Build and start all services

```bash
cd Kampus         # repo root (where docker-compose.yml lives)
docker compose up --build -d
```

### 4. Run database migrations inside the container

```bash
docker compose exec web npx prisma migrate deploy
```

### 5. Access the app

Open **http://localhost:3000**

### Useful Docker commands

```bash
# View logs
docker compose logs -f web

# Stop everything
docker compose down

# Stop & remove all data (fresh start)
docker compose down -v

# Rebuild just the web container
docker compose up --build web -d

# Open Prisma Studio (database GUI) — runs locally, not in Docker
cd web && npx prisma studio
```

## Environment Variables

All variables go in `web/.env` for local development, or in your hosting platform's environment settings.

| Variable |  Description |
|----------|-------------|
| `DATABASE_URL` |  Full PostgreSQL connection string. Format: `postgresql://USER:PASS@HOST:PORT/DB` |
| `JWT_SECRET` |  Secret string for signing JWTs. Use a long random string. |
| `GOOGLE_CLIENT_ID` |  Google OAuth 2.0 Client ID. Get from [Google Cloud Console](https://console.cloud.google.com/). |
| `GOOGLE_CLIENT_SECRET` |  Google OAuth 2.0 Client Secret. |
| `NEXT_PUBLIC_APP_URL` |  The public-facing URL of the app (e.g. `http://localhost:3000` or `https://yourapp.vercel.app`). Used for OAuth redirect URIs. |
| `OPENAI_API_KEY` |  OpenAI API key for AI Schedule Optimization. Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys). |

### Setting up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Calendar API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Set **Application type** to **Web application**
6. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/gcal/callback` (local dev)
   - `https://your-domain.com/api/gcal/callback` (production)
7. Copy `Client ID` → `GOOGLE_CLIENT_ID`
8. Copy `Client Secret` → `GOOGLE_CLIENT_SECRET`

---

## Database Setup

Kampus uses **PostgreSQL** with **Prisma ORM**.

### Running migrations

```bash
cd web

# Apply all pending migrations (production-safe)
npx prisma migrate deploy

# Apply + create new migration (dev only)
npx prisma migrate dev --name your_migration_name

# Open Prisma Studio GUI
npx prisma studio

# Reset database (destroys all data)
npx prisma migrate reset
```

### Seed demo data

Once the app is running, click **"Load Demo Data"** on the Dashboard, or call:

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Chrome Extension Setup

The Kampus Chrome Extension (Manifest V3) is the data bridge between UNL's web portals (Canvas, MyRed, NvolveU) and the Kampus platform.

### What it syncs

| Source | Data Synced |
|--------|------------|
| **Canvas** (`canvas.unl.edu`) | Courses, assignments, grades, due dates |
| **MyRed** (`myred.nebraska.edu`) | Class schedule (days, times, locations, instructors) |
| **NvolveU** (`unl.campuslabs.com`) | Campus events, org activities, attendance |

### Installation (Developer Mode)

The extension is **not on the Chrome Web Store** — you load it manually.

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **"Load unpacked"**
4. Select the `kampus-extension/` folder from this repository
5. The Kampus icon will appear in your Chrome toolbar

### Configuring the extension for production

By default, the extension points to `http://localhost:3000`. To use it with your hosted instance:

1. Open `kampus-extension/background.js`
2. Find the `BASE_URL` constant at the top of the file and update it:

```js
const BASE_URL = "https://your-vercel-url.vercel.app";
// or
const BASE_URL = "https://your-custom-domain.com";
```

3. Also update **`manifest.json`** → `host_permissions` to include your production URL:

```json
"host_permissions": [
  "https://canvas.unl.edu/*",
  "https://myred.nebraska.edu/*",
  "https://myred.unl.edu/*",
  "https://unl.campuslabs.com/*",
]
```

4. Reload the extension in `chrome://extensions` by clicking the refresh icon.

### How data syncs

Once installed and authenticated, the extension syncs automatically in the background every time you visit the UNL portals:

- **Canvas** — Synced when you visit any `canvas.unl.edu/*` page
- **MyRed** — Synced when you visit `myred.nebraska.edu/*`
- **NvolveU** — Synced when you visit `unl.campuslabs.com/*`

You can also trigger a manual sync from the extension popup.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | JWT (email/password) + UNL Shibboleth CAS SSO |
| **Google Calendar** | Google Calendar API v3 (OAuth 2.0) |
| **AI** | OpenAI GPT-4o (schedule optimization, pattern analysis) |
| **Charts** | Recharts |
| **Real-time** | Socket.io (study session chat) |
| **Browser Extension** | Chrome Manifest V3 |
| **Containerization** | Docker + Docker Compose |

## User Authentication

Kampus supports two login methods:

1. **Email & Password** — Works everywhere (local, Docker). Register at `/register`.
2. **UNL NetID SSO** — Uses UNL Shibboleth CAS. Only works when your callback URL (`/api/auth/cas/callback`) is registered with UNL ITS. Works out of the box for `localhost` development. For production, contact UNL ITS Help Desk to register your URL.


## Local Dev Tips

```bash
# Run the app in dev mode (hot reload)
cd web && npm run dev

# Run a production build locally to catch errors
npm run build && npm start

# Lint the codebase
npm run lint

# Open Prisma Studio (database GUI)
npx prisma studio

# Push schema changes without migrations (dev only)
npx prisma db push

# Regenerate Prisma Client after schema changes
npx prisma generate
```

## Key File Reference

| Path | Purpose |
|------|---------|
| `web/src/app/api/` | All backend API routes |
| `web/src/app/dashboard/` | All dashboard page components |
| `web/src/lib/api-client.ts` | Frontend SDK for all API calls |
| `web/src/lib/auth.ts` | JWT sign/verify helpers |
| `web/src/lib/google-calendar.ts` | Google Calendar API helpers |
| `web/prisma/schema.prisma` | Full database schema |
| `kampus-extension/background.js` | Extension service worker + sync logic |
| `kampus-extension/content-scripts/canvas.js` | Canvas data scraper |
| `kampus-extension/content-scripts/myred.js` | MyRed schedule scraper |