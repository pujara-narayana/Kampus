import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { grades } = await req.json();

    if (!Array.isArray(grades)) {
      return NextResponse.json(
        { error: "grades must be an array" },
        { status: 400 }
      );
    }

    const results = [];

    for (const g of grades) {
      // Find the course by canvasId
      const course = await prisma.course.findUnique({
        where: {
          canvasId_userId: {
            canvasId: BigInt(g.courseCanvasId),
            userId: user.id,
          },
        },
      });

      if (!course) continue;

      // Update course grade
      await prisma.course.update({
        where: { id: course.id },
        data: {
          currentGrade: g.currentGrade ? String(g.currentGrade).substring(0, 5) : null,
          currentScore: g.currentScore ?? null,
        },
      });

      // Find assignment if provided
      let assignmentId: string | null = null;
      if (g.assignmentCanvasId) {
        const assignment = await prisma.assignment.findUnique({
          where: {
            canvasId_userId: {
              canvasId: BigInt(g.assignmentCanvasId),
              userId: user.id,
            },
          },
        });
        if (assignment) {
          assignmentId = assignment.id;

          // Update assignment score
          await prisma.assignment.update({
            where: { id: assignment.id },
            data: {
              score: g.score ?? null,
            },
          });
        }
      }

      // Insert grade history record
      const history = await prisma.gradeHistory.create({
        data: {
          userId: user.id,
          courseId: course.id,
          assignmentId,
          score: g.score ?? null,
          pointsPossible: g.pointsPossible ?? null,
        },
      });

      results.push(history.id);
    }

    return NextResponse.json({
      synced: results.length,
      gradeHistoryIds: results,
    });
  } catch (error) {
    console.error("Sync grades error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
