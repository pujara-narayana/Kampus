import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupChatId } = await params;
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    const now = new Date();

    const groupChat = await prisma.groupChat.findUnique({
      where: { id: groupChatId },
    });

    if (!groupChat) {
      return NextResponse.json({ error: "Group chat not found" }, { status: 404 });
    }

    if (groupChat.hiddenAt && groupChat.hiddenAt <= now) {
      return NextResponse.json({ error: "This group chat is no longer available" }, { status: 403 });
    }

    // Check membership
    const member = await prisma.groupChatMember.findUnique({
      where: { groupChatId_userId: { groupChatId, userId: user.id } },
    });

    if (!member || member.removedAt) {
      return NextResponse.json({ error: "You are not a member of this group chat" }, { status: 403 });
    }

    const message = await prisma.groupChatMessage.create({
      data: {
        groupChatId,
        senderId: user.id,
        body: text.trim(),
      },
      include: {
        sender: { select: { id: true, displayName: true } },
      },
    });

    // Update group chat timestamp
    await prisma.groupChat.update({
      where: { id: groupChatId },
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
    }, { status: 201 });
  } catch (error) {
    console.error("Send group message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
