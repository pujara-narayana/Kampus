import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/sessions/:id/invite/revoke
 * Revoke an invite (creator only). Body: { userId: string }
 * Removes the participant from the session if they are still "invited".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : null;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: "sessionId and userId are required" },
        { status: 400 }
      );
    }

    const session = await prisma.studySession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.creatorId !== user.id) {
      return NextResponse.json(
        { error: "Only the session creator can revoke invites" },
        { status: 403 }
      );
    }

    const participant = await prisma.sessionParticipant.findUnique({
      where: {
        sessionId_userId: { sessionId, userId },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "User is not a participant" },
        { status: 404 }
      );
    }

    if (participant.status !== "invited") {
      return NextResponse.json(
        { error: "Can only revoke invites for users who have not yet accepted" },
        { status: 400 }
      );
    }

    await prisma.sessionParticipant.delete({
      where: { id: participant.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
