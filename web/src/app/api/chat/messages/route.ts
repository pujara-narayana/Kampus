import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** POST /api/chat/messages - Send a message in a conversation */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, text } = body;

    if (!conversationId || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "conversationId and text are required" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const isParticipant =
      conversation.user1Id === user.id || conversation.user2Id === user.id;
    if (!isParticipant) {
      return NextResponse.json(
        { error: "You are not in this conversation" },
        { status: 403 }
      );
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body: text.trim().slice(0, 10000),
      },
      include: {
        sender: {
          select: { id: true, displayName: true },
        },
      },
    });

    // Touch conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        senderName: message.sender.displayName,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
