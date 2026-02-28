import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string; userId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupChatId, userId: targetUserId } = await params;

    // Verify the caller is an admin
    const callerMember = await prisma.groupChatMember.findUnique({
      where: { groupChatId_userId: { groupChatId, userId: user.id } },
    });

    if (!callerMember || callerMember.removedAt || callerMember.role !== "admin") {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }

    // Can't remove yourself
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    // Find the target member
    const targetMember = await prisma.groupChatMember.findUnique({
      where: { groupChatId_userId: { groupChatId, userId: targetUserId } },
    });

    if (!targetMember || targetMember.removedAt) {
      return NextResponse.json({ error: "User is not an active member" }, { status: 404 });
    }

    // Soft-delete the member
    await prisma.groupChatMember.update({
      where: { id: targetMember.id },
      data: { removedAt: new Date() },
    });

    // Also update SessionParticipant status
    const groupChat = await prisma.groupChat.findUnique({
      where: { id: groupChatId },
    });

    if (groupChat) {
      await prisma.sessionParticipant.updateMany({
        where: { sessionId: groupChat.sessionId, userId: targetUserId },
        data: { status: "declined", respondedAt: new Date() },
      });
    }

    // Notify the removed user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { displayName: true },
    });

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: "session_removed",
        title: "Removed from session",
        body: `You were removed from the study session "${groupChat?.name || "Study Session"}"`,
        data: { groupChatId, sessionId: groupChat?.sessionId },
      },
    });

    return NextResponse.json({ success: true, message: "Member removed" });
  } catch (error) {
    console.error("Remove group chat member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
