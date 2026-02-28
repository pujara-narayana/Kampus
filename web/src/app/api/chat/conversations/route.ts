import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** GET /api/chat/conversations - List my conversations (only with accepted connections) */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: user.id }, { user2Id: user.id }],
      },
      include: {
        user1: {
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        },
        user2: {
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Only include conversations where the other user is an accepted connection
    const connectionUserIds = await prisma.connection
      .findMany({
        where: {
          OR: [{ requesterId: user.id }, { receiverId: user.id }],
          status: "accepted",
        },
      })
      .then((conns) =>
        conns.map((c) => (c.requesterId === user.id ? c.receiverId : c.requesterId))
      );
    const connectionSet = new Set(connectionUserIds);

    const filtered = conversations
      .filter((c) => {
        const otherId = c.user1Id === user.id ? c.user2Id : c.user1Id;
        return connectionSet.has(otherId);
      })
      .map((c) => {
        const other = c.user1Id === user.id ? c.user2 : c.user1;
        const lastMessage = c.messages[0] ?? null;
        return {
          id: c.id,
          otherUser: {
            id: other.id,
            displayName: other.displayName,
            avatarUrl: other.avatarUrl,
            email: other.email,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                body: lastMessage.body,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          updatedAt: c.updatedAt,
        };
      });

    return NextResponse.json({ conversations: filtered });
  } catch (error) {
    console.error("List conversations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
