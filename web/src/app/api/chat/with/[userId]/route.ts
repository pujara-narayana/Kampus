import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

function orderedIds(userId: string, otherUserId: string): [string, string] {
  return userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
}

/** GET /api/chat/with/[userId] - Get or create conversation with a connection, return messages */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: otherUserId } = await params;
    if (!otherUserId || otherUserId === user.id) {
      return NextResponse.json(
        { error: "Invalid user" },
        { status: 400 }
      );
    }

    const [user1Id, user2Id] = orderedIds(user.id, otherUserId);

    // Allow if accepted connection, or if a conversation already exists (e.g. they sent you a session invite)
    const [connection, existingConversation] = await Promise.all([
      prisma.connection.findFirst({
        where: {
          OR: [
            { requesterId: user.id, receiverId: otherUserId },
            { requesterId: otherUserId, receiverId: user.id },
          ],
          status: "accepted",
        },
      }),
      prisma.conversation.findUnique({
        where: { user1Id_user2Id: { user1Id, user2Id } },
      }),
    ]);
    if (!connection && !existingConversation) {
      return NextResponse.json(
        { error: "You can only chat with accepted connections" },
        { status: 403 }
      );
    }

    let conversation = await prisma.conversation.findUnique({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      include: {
        user1: {
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        },
        user2: {
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { user1Id, user2Id },
        include: {
          user1: {
            select: { id: true, displayName: true, avatarUrl: true, email: true },
          },
          user2: {
            select: { id: true, displayName: true, avatarUrl: true, email: true },
          },
        },
      });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const before = searchParams.get("before"); // cursor for pagination

    const messages = await prisma.directMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(before
        ? { cursor: { id: before }, skip: 1 }
        : {}),
      include: {
        sender: {
          select: { id: true, displayName: true },
        },
      },
    });

    const hasMore = messages.length > limit;
    const list = hasMore ? messages.slice(0, limit) : messages;

    const otherUser =
      conversation.user1Id === user.id ? conversation.user2 : conversation.user1;

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        otherUser: {
          id: otherUser.id,
          displayName: otherUser.displayName,
          avatarUrl: otherUser.avatarUrl,
          email: otherUser.email,
        },
      },
      messages: list.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        senderId: m.senderId,
        senderName: m.sender.displayName,
        createdAt: m.createdAt,
        metadata: m.metadata as { type?: string; sessionId?: string } | null,
      })),
      hasMore,
      nextCursor: hasMore ? list[list.length - 1].id : null,
    });
  } catch (error) {
    console.error("Get chat with user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
