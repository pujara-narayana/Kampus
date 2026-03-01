/**
 * Google Calendar OAuth and API helpers.
 * Used to sync the user's Google Calendar into the Kampus calendar view.
 */

import { google } from "googleapis";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events", // Read + create/update/delete events
  "https://www.googleapis.com/auth/calendar.readonly", // List calendars / primary
];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
  scope?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end?: string;
  htmlLink?: string;
}

function getOAuth2Client(redirectUri?: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri || undefined
  );
}

/**
 * Build the Google OAuth consent URL. Redirect the user here to connect their calendar.
 */
export function getAuthUrl(state: string, redirectUri: string): string {
  const oauth2 = getOAuth2Client(redirectUri);
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // Force refresh_token on first auth
    scope: SCOPES,
    state,
  });
}

/**
 * Exchange authorization code for tokens.
 */
export async function getTokensFromCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const oauth2 = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) throw new Error("No access token from Google");
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? 0,
    scope: tokens.scope ?? undefined,
  };
}

/** Refresh access token if expired (or within 5 min). Returns tokens to persist. */
export async function refreshGoogleTokensIfNeeded(
  storedTokens: GoogleTokens
): Promise<GoogleTokens> {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: storedTokens.access_token,
    refresh_token: storedTokens.refresh_token,
    expiry_date: storedTokens.expiry_date,
  });
  await oauth2.getAccessToken();
  const c = oauth2.credentials;
  return {
    access_token: c.access_token ?? storedTokens.access_token,
    refresh_token: c.refresh_token ?? storedTokens.refresh_token,
    expiry_date: c.expiry_date ?? storedTokens.expiry_date,
    scope: c.scope ?? storedTokens.scope,
  };
}

/**
 * Fetch events from the user's primary Google Calendar for the given time range.
 * Uses stored tokens (with refresh if needed).
 */
export async function fetchGoogleCalendarEvents(
  storedTokens: GoogleTokens,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: storedTokens.access_token,
    refresh_token: storedTokens.refresh_token,
    expiry_date: storedTokens.expiry_date,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const items = res.data.items ?? [];
  const out: GoogleCalendarEvent[] = [];

  for (const ev of items) {
    const start = ev.start?.dateTime ?? ev.start?.date;
    const end = ev.end?.dateTime ?? ev.end?.date;
    if (!start) continue;
    out.push({
      id: ev.id ?? `gcal-${ev.id}`,
      title: ev.summary ?? "(No title)",
      start,
      end: end ?? undefined,
      htmlLink: ev.htmlLink ?? undefined,
    });
  }

  return out;
}

export interface CreateGoogleCalendarEventInput {
  title: string;
  start: Date | string;
  end?: Date | string;
  description?: string;
  location?: string;
}

/**
 * Create an event on the user's primary Google Calendar.
 * Used when creating a study session so it appears in their Google Calendar.
 */
export async function createGoogleCalendarEvent(
  storedTokens: GoogleTokens,
  input: CreateGoogleCalendarEventInput
): Promise<{ id: string; htmlLink?: string } | null> {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: storedTokens.access_token,
    refresh_token: storedTokens.refresh_token,
    expiry_date: storedTokens.expiry_date,
  });

  const start = typeof input.start === "string" ? new Date(input.start) : input.start;
  const end =
    input.end !== undefined
      ? typeof input.end === "string"
        ? new Date(input.end)
        : input.end
      : new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });

  const id = res.data.id ?? null;
  const htmlLink = res.data.htmlLink ?? undefined;
  return id ? { id, htmlLink } : null;
}

/** Map single-letter day codes (M,T,W,R,F) to Google RRULE BYDAY (MO,TU,WE,TH,FR). */
function daysToByDay(days: string): string {
  const map: Record<string, string> = { M: "MO", T: "TU", W: "WE", R: "TH", F: "FR" };
  return (days || "")
    .replace(/\s/g, "")
    .split("")
    .map((d) => map[d.toUpperCase()])
    .filter(Boolean)
    .join(",");
}

export interface CreateRecurringGoogleCalendarEventInput {
  title: string;
  days: string; // e.g. "MWF"
  startTime: string; // "11:30" 24h
  endTime: string; // "12:20" 24h
  location?: string;
  description?: string;
  /** First date (YYYY-MM-DD) for the series. Defaults to start of current month. */
  startDate?: string;
  /** Last date (YYYY-MM-DD) for the series. Defaults to end of semester. */
  untilDate?: string;
}

/**
 * Create a recurring event on the user's primary Google Calendar (e.g. for a class).
 */
export async function createRecurringGoogleCalendarEvent(
  storedTokens: GoogleTokens,
  input: CreateRecurringGoogleCalendarEventInput
): Promise<{ id: string; htmlLink?: string } | null> {
  const byDay = daysToByDay(input.days);
  if (!byDay) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDate = input.startDate
    ? new Date(input.startDate + "T12:00:00")
    : new Date(year, month, 1);
  const untilDate = input.untilDate
    ? new Date(input.untilDate + "T23:59:59")
    : new Date(year, month <= 4 ? 5 : 11, month <= 4 ? 15 : 15); // May 15 or Dec 15

  const [sh, sm] = (input.startTime || "08:00").split(":").map(Number);
  const [eh, em] = (input.endTime || "09:00").split(":").map(Number);
  const firstStart = new Date(startDate);
  firstStart.setHours(sh, sm || 0, 0, 0);
  const firstEnd = new Date(startDate);
  firstEnd.setHours(eh, em || 0, 0, 0);

  const dayNums = (input.days || "").replace(/\s/g, "").split("").map((d) => {
    const m: Record<string, number> = { M: 1, T: 2, W: 3, R: 4, F: 5 };
    return m[d.toUpperCase()];
  }).filter((n) => n != null) as number[];
  for (let d = 0; d < 7; d++) {
    const d2 = new Date(startDate);
    d2.setDate(d2.getDate() + d);
    if (dayNums.includes(d2.getDay())) {
      firstStart.setTime(d2.getTime());
      firstStart.setHours(sh, sm || 0, 0, 0);
      firstEnd.setTime(d2.getTime());
      firstEnd.setHours(eh, em || 0, 0, 0);
      break;
    }
  }

  const untilRrule = untilDate.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilRrule}`;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: storedTokens.access_token,
    refresh_token: storedTokens.refresh_token,
    expiry_date: storedTokens.expiry_date,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { dateTime: firstStart.toISOString() },
      end: { dateTime: firstEnd.toISOString() },
      recurrence: [rrule],
    },
  });

  const id = res.data.id ?? null;
  const htmlLink = res.data.htmlLink ?? undefined;
  return id ? { id, htmlLink } : null;
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
