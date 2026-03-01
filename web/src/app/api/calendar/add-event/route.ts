import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  createGoogleCalendarEvent,
  refreshGoogleTokensIfNeeded,
  type GoogleTokens,
} from "@/lib/google-calendar";

/**
 * POST /api/calendar/add-event
 * Add a campus event to the user's Google Calendar.
 * Body: { title: string, startTime: string (ISO), endTime?: string, description?: string, location?: string }
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

    const body = await req.json();
    const title = body.title;
    const startTime = body.startTime;
    if (!title || !startTime) {
      return NextResponse.json(
        { error: "title and startTime are required" },
        { status: 400 }
      );
    }

    const freshTokens = await refreshGoogleTokensIfNeeded(tokens);
    await prisma.user.update({
      where: { id: user.id },
      data: { googleToken: freshTokens as object },
    });

    const created = await createGoogleCalendarEvent(freshTokens, {
      title: String(title),
      start: startTime,
      end: body.endTime ? String(body.endTime) : undefined,
      description: body.description ? String(body.description) : undefined,
      location: body.location ? String(body.location) : undefined,
    });

    if (created?.id) {
      const settings = (user.settings as { addedToGoogleEventIds?: string[] }) ?? {};
      const ids = [...(settings.addedToGoogleEventIds ?? []), created.id];
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { ...settings, addedToGoogleEventIds: ids } as object },
      });
    }

    return NextResponse.json({ ok: true, googleCalendarAdded: true });
  } catch (error) {
    console.error("Add event to Google Calendar error:", error);
    return NextResponse.json(
      { error: "Failed to add event to Google Calendar" },
      { status: 500 }
    );
  }
}
