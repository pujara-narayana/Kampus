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

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
