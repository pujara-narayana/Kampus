import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.creatorId !== user.id) {
      return NextResponse.json({ error: "Only the creator can end the session" }, { status: 403 });
    }

    if (session.status === "completed") {
      return NextResponse.json({ error: "Session is already ended" }, { status: 400 });
    }

    // Update session status
    await prisma.studySession.update({
      where: { id },
      data: { status: "completed" },
    });

    // Set group chat hidden_at to 24 hours from now
    const hiddenAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.groupChat.updateMany({
      where: { sessionId: id },
      data: { hiddenAt },
    });

    return NextResponse.json({ success: true, message: "Session ended", hiddenAt });
  } catch (error) {
    console.error("End session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
