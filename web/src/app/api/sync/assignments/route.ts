import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { estimateAssignmentTime } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assignments } = await req.json();

    if (!Array.isArray(assignments)) {
      return NextResponse.json(
        { error: "assignments must be an array" },
        { status: 400 }
      );
    }

    const results = [];

    for (const a of assignments) {
      // Find the course by canvasId + userId
      const course = await prisma.course.findUnique({
        where: {
          canvasId_userId: {
            canvasId: BigInt(a.courseCanvasId),
            userId: user.id,
          },
        },
      });

      if (!course) continue;

      const upserted = await prisma.assignment.upsert({
        where: {
          canvasId_userId: {
            canvasId: BigInt(a.canvasId),
            userId: user.id,
          },
        },
        update: {
          name: a.name,
          description: a.description || null,
          dueAt: a.dueAt ? new Date(a.dueAt) : null,
          pointsPossible: a.pointsPossible ?? null,
          submissionTypes: a.submissionTypes || [],
          hasSubmitted: a.hasSubmitted ?? false,
          score: a.score ?? null,
          submittedAt: a.submittedAt ? new Date(a.submittedAt) : null,
          htmlUrl: a.htmlUrl || null,
          syncedAt: new Date(),
        },
        create: {
          canvasId: BigInt(a.canvasId),
          courseId: course.id,
          userId: user.id,
          name: a.name,
          description: a.description || null,
          dueAt: a.dueAt ? new Date(a.dueAt) : null,
          pointsPossible: a.pointsPossible ?? null,
          submissionTypes: a.submissionTypes || [],
          hasSubmitted: a.hasSubmitted ?? false,
          score: a.score ?? null,
          submittedAt: a.submittedAt ? new Date(a.submittedAt) : null,
          htmlUrl: a.htmlUrl || null,
        },
      });

      // Run time estimation if no estimate exists yet
      if (!upserted.estimatedHours) {
        try {
          const estimate = await estimateAssignmentTime({
            name: a.name || "",
            courseName: course.name || "",
            description: a.description || "",
            pointsPossible: Number(a.pointsPossible) || 0,
            submissionTypes: a.submissionTypes || [],
          });

          await prisma.assignment.update({
            where: { id: upserted.id },
            data: { estimatedHours: estimate.hours },
          });
        } catch {
          // Non-critical: skip estimation on failure
        }
      }

      results.push(upserted.id);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      synced: results.length,
      assignmentIds: results,
    });
  } catch (error) {
    console.error("Sync assignments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
