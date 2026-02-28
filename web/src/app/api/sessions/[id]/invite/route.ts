import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/sessions/:id/invite
 * Invite users to a study session (creator only).
 * Body: { userIds: string[] }
 * Creates SessionParticipant with status "invited" and notifies each user.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const userIds = Array.isArray(body.userIds) ? body.userIds as string[] : [];

    if (!sessionId || userIds.length === 0) {
      return NextResponse.json(
        { error: "sessionId and userIds array are required" },
        { status: 400 }
      );
    }

    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { participants: true } } },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.creatorId !== user.id) {
      return NextResponse.json(
        { error: "Only the session creator can invite others" },
        { status: 403 }
      );
    }

    if (session.status !== "upcoming" && session.status !== "active") {
      return NextResponse.json(
        { error: "Session is no longer accepting invites" },
        { status: 400 }
      );
    }

    const invited: string[] = [];
    const skipped: string[] = [];
    let participantCount = session._count.participants;

    for (const userId of userIds) {
      if (userId === user.id) {
        skipped.push(userId);
        continue;
      }
      if (participantCount >= session.maxParticipants) break;

      const existing = await prisma.sessionParticipant.findUnique({
        where: {
          sessionId_userId: { sessionId, userId },
        },
      });
      if (existing) {
        skipped.push(userId);
        continue;
      }

      await prisma.sessionParticipant.create({
        data: {
          sessionId,
          userId,
          status: "invited",
        },
      });

      await prisma.notification.create({
        data: {
          userId,
          type: "session_invite",
          title: "Study session invite",
          body: `${user.displayName || "Someone"} invited you to "${session.title}"`,
          data: { sessionId, inviterId: user.id },
        },
      });

      invited.push(userId);
      participantCount += 1;
    }

    return NextResponse.json({
      invited: invited.length,
      skipped: skipped.length,
      message: `Invited ${invited.length} user(s).`,
    });
  } catch (error) {
    console.error("Session invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
