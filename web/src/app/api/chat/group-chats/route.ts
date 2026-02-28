import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    const groupChats = await prisma.groupChat.findMany({
      where: {
        members: {
          some: { userId: user.id, removedAt: null },
        },
        OR: [
          { hiddenAt: null },
          { hiddenAt: { gt: now } },
        ],
      },
      include: {
        session: {
          select: { id: true, title: true, status: true },
        },
        _count: {
          select: { members: { where: { removedAt: null } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, displayName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = groupChats.map((gc) => ({
      id: gc.id,
      name: gc.name,
      sessionId: gc.sessionId,
      sessionTitle: gc.session.title,
      sessionStatus: gc.session.status,
      memberCount: gc._count.members,
      updatedAt: gc.updatedAt,
      lastMessage: gc.messages[0]
        ? {
            id: gc.messages[0].id,
            body: gc.messages[0].body,
            senderId: gc.messages[0].senderId,
            senderName: gc.messages[0].sender.displayName,
            createdAt: gc.messages[0].createdAt,
          }
        : null,
    }));

    return NextResponse.json({ groupChats: result });
  } catch (error) {
    console.error("List group chats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
