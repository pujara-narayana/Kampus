import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/social/people
 * Returns users who share at least one course with the current user
 * (same canvas course), excluding self and users already connected.
 * Used for "People in your courses" discovery.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's course canvas IDs (from Course table)
    const myCourses = await prisma.course.findMany({
      where: { userId: user.id },
      select: { canvasId: true },
    });
    const myCanvasIds = myCourses.map((c) => c.canvasId);
    if (myCanvasIds.length === 0) {
      return NextResponse.json({ people: [], total: 0 });
    }

    // Find other users who have a course with any of these canvas IDs
    const otherUserCourses = await prisma.course.findMany({
      where: {
        canvasId: { in: myCanvasIds },
        userId: { not: user.id },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    const candidateIds = otherUserCourses.map((c) => c.userId);
    if (candidateIds.length === 0) {
      return NextResponse.json({ people: [], total: 0 });
    }

    // Exclude users we already have a connection with (any status)
    const existingConnections = await prisma.connection.findMany({
      where: {
        OR: [
          { requesterId: user.id, receiverId: { in: candidateIds } },
          { receiverId: user.id, requesterId: { in: candidateIds } },
        ],
      },
      select: { requesterId: true, receiverId: true },
    });
    const connectedIds = new Set(
      existingConnections.flatMap((c) =>
        c.requesterId === user.id ? [c.receiverId] : [c.requesterId]
      )
    );
    const peopleIds = candidateIds.filter((id) => !connectedIds.has(id));
    if (peopleIds.length === 0) {
      return NextResponse.json({ people: [], total: 0 });
    }

    const people = await prisma.user.findMany({
      where: { id: { in: peopleIds } },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        email: true,
      },
    });

    return NextResponse.json({ people, total: people.length });
  } catch (error) {
    console.error("Social people error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
