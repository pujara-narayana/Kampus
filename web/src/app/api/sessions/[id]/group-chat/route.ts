import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/sessions/:id/group-chat
 * Creates a group chat for the study session if one doesn't exist.
 * Any accepted participant (including creator) can create it. Idempotent.
 * When the study session is deleted, the group chat is deleted (DB cascade).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        groupChat: { select: { id: true } },
        participants: {
          where: { status: "accepted" },
          select: { userId: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const isParticipant = session.creatorId === user.id ||
      session.participants.some((p) => p.userId === user.id);
    if (!isParticipant) {
      return NextResponse.json(
        { error: "You must be in the session to create its group chat" },
        { status: 403 }
      );
    }

    if (session.groupChat) {
      return NextResponse.json(
        { groupChatId: session.groupChat.id, created: false },
        { status: 200 }
      );
    }

    const groupChat = await prisma.groupChat.create({
      data: {
        sessionId: session.id,
        name: session.title || "Study Session Chat",
      },
    });

    const acceptedUserIds = session.participants.map((p) => p.userId);
    if (!acceptedUserIds.includes(user.id)) {
      acceptedUserIds.push(user.id);
    }
    for (const userId of acceptedUserIds) {
      await prisma.groupChatMember.create({
        data: {
          groupChatId: groupChat.id,
          userId,
          role: session.creatorId === userId ? "admin" : "member",
        },
      });
    }

    return NextResponse.json(
      { groupChatId: groupChat.id, created: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create session group chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
