import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's course IDs (for sessions in my courses)
    const userCourses = await prisma.userCourseLink.findMany({
      where: { userId: user.id },
      select: { courseId: true },
    });
    const courseIds = userCourses.map((uc) => uc.courseId);

    // Friend IDs (accepted connections) so we can show friends' sessions
    const connections = await prisma.connection.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: user.id }, { receiverId: user.id }],
      },
      select: { requesterId: true, receiverId: true },
    });
    const friendIds = connections.map((c) =>
      c.requesterId === user.id ? c.receiverId : c.requesterId
    );

    const sessions = await prisma.studySession.findMany({
      where: {
        OR: [
          { courseId: { in: courseIds } },
          { creatorId: user.id },
          { participants: { some: { userId: user.id } } },
          ...(friendIds.length > 0 ? [{ creatorId: { in: friendIds } }] : []),
        ],
        status: { in: ["upcoming", "active"] },
      },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        course: { select: { name: true, code: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Sessions list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const session = await prisma.studySession.create({
      data: {
        creatorId: user.id,
        title: body.title || null,
        description: body.description || null,
        courseId: body.courseId || null,
        assignmentId: body.assignmentId || null,
        building: body.building || null,
        room: body.room || null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        startTime: body.startTime ? new Date(body.startTime) : null,
        endTime: body.endTime ? new Date(body.endTime) : null,
        maxParticipants: body.maxParticipants ?? 10,
        isPublic: body.isPublic ?? true,
      },
    });

    // Auto-add creator as a participant
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        status: "accepted",
        respondedAt: new Date(),
      },
    });

    // Create a feed item
    await prisma.feedItem.create({
      data: {
        userId: user.id,
        type: "study_session_created",
        data: {
          sessionId: session.id,
          title: session.title,
          courseId: session.courseId,
        },
        visibility: session.isPublic ? "public" : "friends",
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
