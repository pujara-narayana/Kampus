import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignmentCanvasId = searchParams.get("assignmentCanvasId");
    const courseId = searchParams.get("courseId");

    if (!assignmentCanvasId && !courseId) {
      return NextResponse.json(
        { error: "assignmentCanvasId or courseId query parameter is required" },
        { status: 400 }
      );
    }

    let userIds: string[] = [];

    if (assignmentCanvasId) {
      // Find all users who have the same assignment (by canvasId) that is not yet submitted
      const assignments = await prisma.assignment.findMany({
        where: {
          canvasId: BigInt(assignmentCanvasId),
          hasSubmitted: false,
          userId: { not: user.id },
        },
        select: { userId: true },
      });
      userIds = assignments.map((a) => a.userId);
    } else if (courseId) {
      // Find all users linked to the same course
      const links = await prisma.userCourseLink.findMany({
        where: {
          courseId,
          userId: { not: user.id },
        },
        select: { userId: true },
      });
      userIds = links.map((l) => l.userId);
    }

    // Deduplicate
    const uniqueIds = [...new Set(userIds)];

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ users, total: users.length });
  } catch (error) {
    console.error("Same boat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
