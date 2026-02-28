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

    return NextResponse.json({ success: true, message: "Left session" });
  } catch (error) {
    console.error("Leave session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
