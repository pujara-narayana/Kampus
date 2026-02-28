import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupChatId } = await params;
    const now = new Date();

    const groupChat = await prisma.groupChat.findUnique({
      where: { id: groupChatId },
      include: {
        session: { select: { id: true, title: true, status: true, creatorId: true } },
        members: {
          where: { removedAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!groupChat) {
      return NextResponse.json({ error: "Group chat not found" }, { status: 404 });
    }

    // Check visibility
    if (groupChat.hiddenAt && groupChat.hiddenAt <= now) {
      return NextResponse.json({ error: "This group chat is no longer available" }, { status: 403 });
    }

    // Check membership
    const isMember = groupChat.members.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json({ error: "You are not a member of this group chat" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const before = searchParams.get("before");

    const messages = await prisma.groupChatMessage.findMany({
      where: { groupChatId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, displayName: true } },
      },
    });

    const hasMore = messages.length > limit;
    const list = hasMore ? messages.slice(0, limit) : messages;

    return NextResponse.json({
      groupChat: {
        id: groupChat.id,
        name: groupChat.name,
        sessionId: groupChat.sessionId,
        sessionTitle: groupChat.session.title,
        sessionStatus: groupChat.session.status,
        creatorId: groupChat.session.creatorId,
      },
      members: groupChat.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })),
      messages: list.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        senderId: m.senderId,
        senderName: m.sender.displayName,
        createdAt: m.createdAt,
      })),
      hasMore,
      nextCursor: hasMore ? list[list.length - 1].id : null,
    });
  } catch (error) {
    console.error("Get group chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
