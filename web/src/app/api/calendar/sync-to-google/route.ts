import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  createRecurringGoogleCalendarEvent,
  refreshGoogleTokensIfNeeded,
  type GoogleTokens,
} from "@/lib/google-calendar";

/**
 * POST /api/calendar/sync-to-google
 * Push the user's Kampus class schedule (and website calendar data) to their Google Calendar.
 * Creates recurring events for each class. Skips classes already synced.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = user.googleToken as GoogleTokens | null;
    if (!tokens?.access_token) {
      return NextResponse.json(
        { error: "Google Calendar not connected", code: "NOT_CONNECTED" },
        { status: 400 }
      );
    }

    const freshTokens = await refreshGoogleTokensIfNeeded(tokens);
    await prisma.user.update({
      where: { id: user.id },
      data: { googleToken: freshTokens as object },
    });

    const classes = await prisma.classSchedule.findMany({
      where: { userId: user.id },
      orderBy: { startTime: "asc" },
    });

    const settings = (user.settings as {
      addedToGoogleEventIds?: string[];
      syncedClassScheduleIds?: Record<string, string>;
    }) ?? {};
    const syncedMap = settings.syncedClassScheduleIds ?? {};
    const addedIds = [...(settings.addedToGoogleEventIds ?? [])];

    let syncedCount = 0;
    for (const cls of classes) {
      if (syncedMap[cls.id]) continue;

      const title = [cls.courseCode, cls.courseTitle].filter(Boolean).join(" — ") || "Class";
      const location = [cls.building, cls.room].filter(Boolean).join(" ") || undefined;
      const created = await createRecurringGoogleCalendarEvent(freshTokens, {
        title,
        days: cls.days ?? "",
        startTime: cls.startTime ?? "08:00",
        endTime: cls.endTime ?? "09:00",
        location,
        description: cls.instructor ? `Instructor: ${cls.instructor}` : undefined,
      });

      if (created?.id) {
        syncedMap[cls.id] = created.id;
        addedIds.push(created.id);
        syncedCount++;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        settings: {
          ...settings,
          syncedClassScheduleIds: syncedMap,
          addedToGoogleEventIds: addedIds,
        } as object,
      },
    });

    return NextResponse.json({ ok: true, synced: syncedCount, total: classes.length });
  } catch (error) {
    console.error("Sync to Google Calendar error:", error);
    return NextResponse.json(
      { error: "Failed to sync to Google Calendar" },
      { status: 500 }
    );
  }
}
