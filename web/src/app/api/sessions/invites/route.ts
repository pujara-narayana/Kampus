import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/sessions/invites
 * Returns sessions where the current user has a pending "invited" status.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingInvites = await prisma.sessionParticipant.findMany({
      where: {
        userId: user.id,
        status: "invited",
      },
      include: {
        session: {
          include: {
            creator: { select: { id: true, displayName: true, avatarUrl: true } },
            course: { select: { name: true, code: true } },
            _count: { select: { participants: true } },
          },
        },
      },
      orderBy: { invitedAt: "desc" },
    });

    const invites = pendingInvites.map((p) => ({
      participantId: p.id,
      sessionId: p.session.id,
      sessionTitle: p.session.title,
      sessionDescription: p.session.description,
      sessionBuilding: p.session.building,
      sessionRoom: p.session.room,
      sessionStartTime: p.session.startTime,
      sessionStatus: p.session.status,
      maxParticipants: p.session.maxParticipants,
      participantCount: p.session._count.participants,
      creator: p.session.creator,
      course: p.session.course,
      invitedAt: p.invitedAt,
    }));

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Get session invites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
