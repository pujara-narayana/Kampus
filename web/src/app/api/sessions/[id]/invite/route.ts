import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

function orderedUserIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

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
    const raw = body.userIds ?? body.user_ids;
    const userIds = Array.isArray(raw)
      ? (raw as unknown[]).map((id) => (typeof id === "string" ? id : String(id))).filter(Boolean)
      : [];

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }
    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required and must contain at least one user id" },
        { status: 400 }
      );
    }

    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
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
    let participantCount = await prisma.sessionParticipant.count({
      where: {
        sessionId,
        status: { in: ["accepted", "invited"] },
      },
    });

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
        if (existing.status === "accepted" || existing.status === "invited") {
          skipped.push(userId);
          continue;
        }
        // Re-invite: they previously declined, update to invited and send again
        await prisma.sessionParticipant.update({
          where: { id: existing.id },
          data: { status: "invited", respondedAt: null },
        });
      } else {
        await prisma.sessionParticipant.create({
          data: {
            sessionId,
            userId,
            status: "invited",
          },
        });
      }

      await prisma.notification.create({
        data: {
          userId,
          type: "session_invite",
          title: "Study session invite",
          body: `${user.displayName || "Someone"} invited you to "${session.title}"`,
          data: { sessionId, inviterId: user.id },
        },
      });

      // Send a DM to the invitee: "[Inviter] invited you to [session title] group chat"
      const inviterName = user.displayName || "Someone";
      const sessionTitle = session.title || "a study session";
      const dmBody = `${inviterName} invited you to the "${sessionTitle}" group chat.`;
      const [user1Id, user2Id] = orderedUserIds(user.id, userId);
      let conversation = await prisma.conversation.findUnique({
        where: { user1Id_user2Id: { user1Id, user2Id } },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { user1Id, user2Id },
        });
      }
      await prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          body: dmBody,
          metadata: { type: "session_invite", sessionId },
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      invited.push(userId);
      participantCount += 1;
    }

    const message =
      invited.length > 0
        ? `Invited ${invited.length} user(s).`
        : skipped.length > 0
          ? `No one invited: ${skipped.length} already in session or session is full.`
          : `Invited ${invited.length} user(s).`;

    return NextResponse.json({
      invited: invited.length,
      skipped: skipped.length,
      message,
    });
  } catch (error) {
    console.error("Session invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
