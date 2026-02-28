import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  fetchGoogleCalendarEvents,
  type GoogleTokens,
} from "@/lib/google-calendar";
import { getEventsFromData } from "@/lib/events-data";

function defaultCalendarRange(): { timeMin: Date; timeMax: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
  return { timeMin: start, timeMax: end };
}

/** Recursively convert BigInt to string so NextResponse.json() can serialize. */
function serializeBigInt<T>(obj: T): T {
  if (typeof obj === "bigint") return String(obj) as unknown as T;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(serializeBigInt) as unknown as T;
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeBigInt(v);
    return out as unknown as T;
  }
  return obj;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const hasDateFilter = from || to;

    const timeMin = from ? new Date(from) : defaultCalendarRange().timeMin;
    const timeMax = to
      ? new Date(to)
      : defaultCalendarRange().timeMax;

    const [classes, assignments, studySessions] = await Promise.all([
      prisma.classSchedule.findMany({
        where: { userId: user.id },
        orderBy: { startTime: "asc" },
      }),

      prisma.assignment.findMany({
        where: {
          userId: user.id,
          ...(hasDateFilter ? { dueAt: dateFilter } : {}),
        },
        include: { course: { select: { name: true, code: true } } },
        orderBy: { dueAt: "asc" },
      }),

      prisma.studySession.findMany({
        where: {
          OR: [
            { creatorId: user.id },
            { participants: { some: { userId: user.id, status: "accepted" } } },
          ],
          ...(hasDateFilter ? { startTime: dateFilter } : {}),
        },
        include: {
          course: { select: { name: true, code: true } },
          _count: { select: { participants: true } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const events = getEventsFromData({
      from: timeMin,
      to: timeMax,
      limit: 200,
    });

    let googleEvents: Awaited<ReturnType<typeof fetchGoogleCalendarEvents>> = [];
    const tokens = user.googleToken as GoogleTokens | null;
    if (tokens?.access_token) {
      try {
        googleEvents = await fetchGoogleCalendarEvents(
          tokens,
          timeMin,
          timeMax
        );
      } catch (err) {
        console.error("Google Calendar fetch error:", err);
        // Return other calendar data; googleEvents stays []
      }
    }

    const payload = {
      classes,
      assignments,
      events,
      studySessions,
      googleEvents,
      googleConnected: Boolean(tokens?.access_token),
    };
    return NextResponse.json(serializeBigInt(payload));
  } catch (error) {
    console.error("Calendar error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
