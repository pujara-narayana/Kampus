import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type PrismaWithGroupChat = typeof prisma & {
  groupChat?: { findUnique: (args: { where: { sessionId: string } }) => Promise<{ id: string } | null> };
  groupChatMember?: { upsert: (args: unknown) => Promise<unknown>; updateMany: (args: unknown) => Promise<unknown> };
};

function getGroupChatBySessionId(sessionId: string) {
  const p = prisma as PrismaWithGroupChat;
  return p.groupChat ? p.groupChat.findUnique({ where: { sessionId } }) : Promise.resolve(null);
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
      include: { _count: { select: { participants: true } } },
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

    if (session._count.participants >= session.maxParticipants) {
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
      // Update status if previously left
      if (existing.status !== "accepted") {
        await prisma.sessionParticipant.update({
          where: { id: existing.id },
          data: { status: "accepted", respondedAt: new Date() },
        });
      }

      // Add to group chat (upsert handles re-joining) — skip if client has no groupChat (e.g. client not regenerated)
      const groupChat = await getGroupChatBySessionId(id);
      const p = prisma as PrismaWithGroupChat;
      if (groupChat && p.groupChatMember) {
        await p.groupChatMember.upsert({
          where: { groupChatId_userId: { groupChatId: groupChat.id, userId: user.id } },
          update: { removedAt: null },
          create: { groupChatId: groupChat.id, userId: user.id, role: "member" },
        });
      }

      return NextResponse.json({ message: "Already joined", participant: existing }, { status: 200 });
    }

    const participant = await prisma.sessionParticipant.create({
      data: {
        sessionId: id,
        userId: user.id,
        status: "accepted",
        respondedAt: new Date(),
      },
    });

    // Add to group chat — skip if client has no groupChat
    const groupChat = await getGroupChatBySessionId(id);
    const p = prisma as PrismaWithGroupChat;
    if (groupChat && p.groupChatMember) {
      await p.groupChatMember.upsert({
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

    return NextResponse.json({ participant }, { status: 201 });
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

    // Remove from group chat — skip if client has no groupChat
    const groupChat = await getGroupChatBySessionId(id);
    const p = prisma as PrismaWithGroupChat;
    if (groupChat && p.groupChatMember) {
      await p.groupChatMember.updateMany({
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
