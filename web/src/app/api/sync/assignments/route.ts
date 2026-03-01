import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { estimateAssignmentTime, getAssignmentEstimateCacheKey } from "@/lib/ai";

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

      // Run time estimation if no estimate exists yet (check DB cache first to avoid API calls)
      if (!upserted.estimatedHours) {
        try {
          const params = {
            name: a.name || "",
            courseName: course.name || "",
            description: a.description || "",
            pointsPossible: Number(a.pointsPossible) || 0,
            submissionTypes: a.submissionTypes || [],
          };
          const contentHash = getAssignmentEstimateCacheKey(params);
          const dbCached = await prisma.assignmentEstimateCache.findUnique({
            where: { contentHash },
          });
          const estimate = dbCached
            ? { hours: Number(dbCached.estimatedHours), reasoning: dbCached.aiStudyTip }
            : await estimateAssignmentTime(params);

          await prisma.assignment.update({
            where: { id: upserted.id },
            data: {
              estimatedHours: estimate.hours,
              aiStudyTip: estimate.reasoning,
            },
          });
          // Persist to DB cache so future syncs (any user) skip the API
          if (!dbCached) {
            await prisma.assignmentEstimateCache.upsert({
              where: { contentHash },
              create: {
                contentHash,
                estimatedHours: estimate.hours,
                aiStudyTip: estimate.reasoning,
              },
              update: {
                estimatedHours: estimate.hours,
                aiStudyTip: estimate.reasoning,
              },
            });
          }
        } catch {
          // Non-critical: skip estimation on failure
        }
      }

      // Upsert AssignmentBehavior for the predictive engine
      // Calculate procrastination metrics based off due vs submitted
      let daysBeforeDue: number | null = null;
      let procrastinationScore: number | null = null;

      if (a.dueAt && a.submittedAt) {
        const dDue = new Date(a.dueAt).getTime();
        const dSub = new Date(a.submittedAt).getTime();
        daysBeforeDue = (dDue - dSub) / (1000 * 60 * 60 * 24);

        // Simple scale mapping: > 5 days early = 0.0 (Good), < 0 days = 1.0 (Bad)
        if (daysBeforeDue > 5) procrastinationScore = 0.0;
        else if (daysBeforeDue < 0) procrastinationScore = 1.0;
        else procrastinationScore = 1.0 - (daysBeforeDue / 5.0);
      }

      const behavior = await prisma.assignmentBehavior.findFirst({
        where: { userId: user.id, assignmentId: upserted.id }
      });

      if (behavior) {
        await prisma.assignmentBehavior.update({
          where: { id: behavior.id },
          data: {
            dueAt: a.dueAt ? new Date(a.dueAt) : null,
            submittedAt: a.submittedAt ? new Date(a.submittedAt) : null,
            daysBeforeDue: daysBeforeDue !== null ? daysBeforeDue : undefined,
            procrastinationScore: procrastinationScore !== null ? procrastinationScore : undefined
          }
        });
      } else {
        await prisma.assignmentBehavior.create({
          data: {
            userId: user.id,
            assignmentId: upserted.id,
            dueAt: a.dueAt ? new Date(a.dueAt) : null,
            submittedAt: a.submittedAt ? new Date(a.submittedAt) : null,
            daysBeforeDue: daysBeforeDue,
            procrastinationScore: procrastinationScore,
            // Fallbacks so engine doesn't crash:
            actualHours: upserted.estimatedHours || 2.0
          }
        });
      }

      // Automatically store GradeHistory if assignment has a score 
      if (a.score != null) {
        // Check if a grade history exists for this assignment so we don't spam 500 rows per sync
        const latestGrade = await prisma.gradeHistory.findFirst({
          where: { userId: user.id, assignmentId: upserted.id },
          orderBy: { recordedAt: 'desc' }
        });

        if (!latestGrade || Number(latestGrade.score) !== Number(a.score)) {
          await prisma.gradeHistory.create({
            data: {
              userId: user.id,
              courseId: course.id,
              assignmentId: upserted.id,
              score: a.score,
              pointsPossible: a.pointsPossible ?? null
            }
          });
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
