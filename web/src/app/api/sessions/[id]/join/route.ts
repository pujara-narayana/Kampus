import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  createGoogleCalendarEvent,
  refreshGoogleTokensIfNeeded,
  type GoogleTokens,
} from "@/lib/google-calendar";

async function addSessionToGoogleCalendar(
  user: { id: string; googleToken: unknown; settings?: unknown },
  session: {
    title: string | null;
    startTime: Date | null;
    endTime: Date | null;
    description: string | null;
    building: string | null;
    room: string | null;
  }
): Promise<boolean> {
  const tokens = user.googleToken as GoogleTokens | null;
  if (!tokens?.access_token || !session.startTime) return false;
  try {
    const freshTokens = await refreshGoogleTokensIfNeeded(tokens);
    await prisma.user.update({
      where: { id: user.id },
      data: { googleToken: freshTokens as object },
    });
    const created = await createGoogleCalendarEvent(freshTokens, {
      title: session.title || "Study Session",
      start: session.startTime,
      end: session.endTime ?? undefined,
      description: session.description ?? undefined,
      location: [session.building, session.room].filter(Boolean).join(", ") || undefined,
    });
    if (created?.id) {
      const settings = (user.settings as { studySessionGoogleEventIds?: string[] }) ?? {};
      const ids = [...(settings.studySessionGoogleEventIds ?? []), created.id];
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { ...settings, studySessionGoogleEventIds: ids } as object },
      });
    }
    return true;
  } catch (err) {
    console.error("Failed to add joined session to Google Calendar:", err);
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const session = await prisma.studySession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.status !== "upcoming" && session.status !== "active") {
      return NextResponse.json(
        { error: "Session is no longer accepting participants" },
        { status: 400 }
      );
    }

    const acceptedCount = await prisma.sessionParticipant.count({
      where: { sessionId: id, status: "accepted" },
    });
    if (acceptedCount >= session.maxParticipants) {
      return NextResponse.json(
        { error: "Session is full" },
        { status: 400 }
      );
    }

    // Check if already a participant
    const existing = await prisma.sessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId: user.id,
        },
      },
    });

    if (existing) {
      // Update status if not already accepted
      if (existing.status !== "accepted") {
        await prisma.sessionParticipant.update({
          where: { id: existing.id },
          data: { status: "accepted", respondedAt: new Date() },
        });
      }

      // Add to group chat (upsert handles re-joining)
      const groupChat = await prisma.groupChat.findUnique({ where: { sessionId: id } });
      if (groupChat) {
        await prisma.groupChatMember.upsert({
          where: { groupChatId_userId: { groupChatId: groupChat.id, userId: user.id } },
          update: { removedAt: null },
          create: { groupChatId: groupChat.id, userId: user.id, role: "member" },
        });
      }

      const googleCalendarAdded = await addSessionToGoogleCalendar(user, session);
      return NextResponse.json(
        { message: "Already joined", participant: existing, googleCalendarAdded },
        { status: 200 }
      );
    }

    const participant = await prisma.sessionParticipant.create({
      data: {
        sessionId: id,
        userId: user.id,
        status: "accepted",
        respondedAt: new Date(),
      },
    });

    // Add to group chat
    const groupChat = await prisma.groupChat.findUnique({ where: { sessionId: id } });
    if (groupChat) {
      await prisma.groupChatMember.upsert({
        where: { groupChatId_userId: { groupChatId: groupChat.id, userId: user.id } },
        update: { removedAt: null },
        create: { groupChatId: groupChat.id, userId: user.id, role: "member" },
      });
    }

    // Notify session creator
    if (session.creatorId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: session.creatorId,
          type: "session_join",
          title: "New participant",
          body: `${user.displayName || "Someone"} joined your study session "${session.title}"`,
          data: { sessionId: id, userId: user.id },
        },
      });
    }

    const googleCalendarAdded = await addSessionToGoogleCalendar(user, session);
    return NextResponse.json(
      { participant, googleCalendarAdded },
      { status: 201 }
    );
  } catch (error) {
    console.error("Join session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.sessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId: user.id,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Not joined" });
    }

    if (existing.status === "declined") {
      return NextResponse.json({ message: "Already left" });
    }

    await prisma.sessionParticipant.update({
      where: { id: existing.id },
      data: { status: "declined", respondedAt: new Date() },
    });

    // Remove from group chat
    const groupChat = await prisma.groupChat.findUnique({ where: { sessionId: id } });
    if (groupChat) {
      await prisma.groupChatMember.updateMany({
        where: { groupChatId: groupChat.id, userId: user.id, removedAt: null },
        data: { removedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, message: "Left session" });
  } catch (error) {
    console.error("Leave session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
