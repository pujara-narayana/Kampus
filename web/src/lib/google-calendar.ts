/**
 * Google Calendar OAuth and API helpers.
 * Used to sync the user's Google Calendar into the Kampus calendar view.
 */

import { google } from "googleapis";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly", // Pull events into Kampus
  "https://www.googleapis.com/auth/calendar.readonly",        // List calendars / primary
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

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
