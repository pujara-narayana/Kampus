/**
 * Events are loaded from the UNL campus events JSON file at repo root.
 * Maps url, title, date_time, location, image_url, etc. to the app's event shape.
 */

import * as fs from "fs";
import * as path from "path";

export interface EventFromData {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  building: string | null;
  room: string | null;
  hasFreeFood: boolean;
  foodDetails: string | null;
  eventType: string | null;
  orgName: string | null;
  eventUrl: string | null;
  imageUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface UnlEvent {
  url?: string;
  title?: string;
  date_time?: string;
  location?: string;
  description?: string;
  host_organization?: string;
  categories?: string | null;
  perks?: string | null;
  image_url?: string | null;
}

/** Parse "Tuesday, March 24 2026 at 5:00 PM CDT" or "Wednesday, March 4 2026 at 7:30 PM CST" to Date. */
function parseUnlDateTime(dateTimeStr: string): Date | null {
  const match = dateTimeStr.match(/, (\w+ \d{1,2} \d{4}) at (\d{1,2}:\d{2} [AP]M)/i);
  if (!match) return null;
  const [, datePart, timePart] = match;
  const combined = `${datePart} ${timePart}`;
  const d = new Date(combined);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse date_time range; returns [start, end] or [start, null] if no " to ". */
function parseUnlDateRange(dateTime: string): { start: Date | null; end: Date | null } {
  const parts = dateTime.split(" to ").map((s) => s.trim());
  const start = parts[0] ? parseUnlDateTime(parts[0]) : null;
  const end = parts[1] ? parseUnlDateTime(parts[1]) : null;
  return { start, end };
}

function hasFreeFoodHint(perks: string | null | undefined, description: string | null | undefined): boolean {
  const text = [perks, description].filter(Boolean).join(" ").toLowerCase();
  return /food|pizza|snack|breakfast|lunch|dinner|coffee|donut|taco|refreshment|catering/i.test(text);
}

let cachedEvents: EventFromData[] | null = null;

const UNL_EVENTS_FILENAME = "unl_campus_events_20260228_174808.json";

function loadRawUnlEvents(): UnlEvent[] {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "..", UNL_EVENTS_FILENAME),
    path.join(cwd, UNL_EVENTS_FILENAME),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

function loadAndMapEvents(): EventFromData[] {
  if (cachedEvents) return cachedEvents;
  const raw = loadRawUnlEvents();
  cachedEvents = raw.map((e: UnlEvent, i: number) => {
    const { start, end } = parseUnlDateRange(e.date_time ?? "");
    const startTime = start ? start.toISOString() : new Date().toISOString();
    const endTime = end ? end.toISOString() : null;
    const location = e.location ?? null;
    const hasFreeFood = hasFreeFoodHint(e.perks ?? null, e.description ?? null);
    return {
      id: e.url ?? `ev-${i}`,
      title: String(e.title ?? ""),
      description: e.description != null ? String(e.description) : null,
      startTime,
      endTime,
      building: location,
      room: null,
      hasFreeFood,
      foodDetails: hasFreeFood ? "See description" : null,
      eventType: e.categories != null ? String(e.categories) : null,
      orgName: e.host_organization != null ? String(e.host_organization) : null,
      eventUrl: e.url != null ? String(e.url) : null,
      imageUrl: e.image_url != null ? String(e.image_url) : null,
    };
  });
  return cachedEvents;
}

export interface GetEventsOptions {
  freeFoodOnly?: boolean;
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
}

export function getEventsFromData(options: GetEventsOptions = {}): EventFromData[] {
  const all = loadAndMapEvents();
  const now = new Date();
  let list = all.filter((e) => new Date(e.startTime) >= now);

  if (options.from) list = list.filter((e) => new Date(e.startTime) >= options.from!);
  if (options.to) list = list.filter((e) => new Date(e.startTime) <= options.to!);
  if (options.freeFoodOnly) list = list.filter((e) => e.hasFreeFood);

  list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  return list.slice(offset, offset + limit);
}

export function getEventsCount(options: Omit<GetEventsOptions, "limit" | "offset"> = {}): number {
  const all = loadAndMapEvents();
  const now = new Date();
  let list = all.filter((e) => new Date(e.startTime) >= now);
  if (options.from) list = list.filter((e) => new Date(e.startTime) >= options.from!);
  if (options.to) list = list.filter((e) => new Date(e.startTime) <= options.to!);
  if (options.freeFoodOnly) list = list.filter((e) => e.hasFreeFood);
  return list.length;
}
