# Kampus Web App - Setup Guide

## Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)
- PostgreSQL database (local or cloud like Supabase/Neon)
- (Optional) Anthropic API key for AI features

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `web` directory:

```bash
# Database (Required)
DATABASE_URL="postgresql://user:password@localhost:5432/kampus?schema=public"

# Authentication (Required for production, has dev default)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# AI Features (Optional - app works without it)
ANTHROPIC_API_KEY="sk-ant-..."

# API Base URL (Optional - defaults to empty for same-origin)
NEXT_PUBLIC_API_URL=""

# Google Calendar sync (Optional - sync user's Google Calendar into the app)
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"
# App URL for OAuth redirect (e.g. http://localhost:3000 or https://your-domain.com)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Google Calendar (optional):** To let users sync their Google Calendar into the Kampus calendar:
1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Enable the **Google Calendar API**.
3. Create **OAuth 2.0 credentials** (Web application). Add authorized redirect URI: `https://your-domain.com/api/gcal/callback` (and `http://localhost:3000/api/gcal/callback` for local dev).
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_APP_URL` in `.env`.

**Database Options:**

- **Local PostgreSQL**: Install PostgreSQL and create a database
- **Supabase** (Recommended for hackathon): 
  - Go to [supabase.com](https://supabase.com)
  - Create a free project
  - Copy the connection string from Settings → Database
- **Neon** (Alternative):
  - Go to [neon.tech](https://neon.tech)
  - Create a free project
  - Copy the connection string

### 3. Set Up Database

```bash
# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed initial data (campus buildings, etc.)
# This requires the API to be running - see below
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server (hot reload)
- `npm run build` - Build for production
- `npm run start` - Start production server (requires build first)
- `npm run lint` - Run ESLint

## First Time Setup Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Create `.env` file with `DATABASE_URL`
- [ ] Run `npx prisma generate`
- [ ] Run `npx prisma migrate dev` to create database tables
- [ ] Start dev server (`npm run dev`)
- [ ] Register a new account at `/register`
- [ ] (Optional) Set `ANTHROPIC_API_KEY` for AI features
- [ ] (Optional) Seed campus buildings data via `/api/seed` endpoint

## Troubleshooting

### Database Connection Issues

If you see Prisma connection errors:
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running (if using local DB)
- Check firewall/network settings (if using cloud DB)

### Prisma Client Not Found

If you see "PrismaClient is not defined":
```bash
npx prisma generate
```

### Port Already in Use

If port 3000 is taken:
```bash
# Use a different port
npm run dev -- -p 3001
```

### Environment Variables Not Loading

Make sure `.env` is in the `web` directory (not the root), and restart the dev server.

## Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

## Next Steps

1. **Set up the Chrome Extension**: See `kampus-extension/` directory
2. **Configure Extension**: Point it to `http://localhost:3000` (or your deployed URL)
3. **Test the Flow**: 
   - Register/Login in web app
   - Install extension
   - Set extension API URL to your backend
   - Visit Canvas/MyRed to trigger sync

## Architecture Notes

- **Frontend**: Next.js 16 with App Router
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT-based (stored in localStorage)
- **AI**: Anthropic Claude API (optional)
