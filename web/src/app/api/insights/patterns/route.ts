import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Procrastination index: average procrastination_score from behaviors
    const behaviors = await prisma.assignmentBehavior.findMany({
      where: { userId: user.id },
      orderBy: { dueAt: "desc" },
      take: 50,
    });

    const scoredBehaviors = behaviors.filter(
      (b) => b.procrastinationScore !== null
    );
    const procrastinationIndex =
      scoredBehaviors.length > 0
        ? scoredBehaviors.reduce(
            (sum, b) => sum + Number(b.procrastinationScore),
            0
          ) / scoredBehaviors.length
        : null;

    // Study patterns: group study sessions by day of week and hour
    const sessions = await prisma.studySession.findMany({
      where: {
        OR: [
          { creatorId: user.id },
          {
            participants: { some: { userId: user.id, status: "accepted" } },
          },
        ],
        startTime: { not: null },
      },
      select: { startTime: true },
    });

    const studyByDay: Record<number, number> = {};
    const studyByHour: Record<number, number> = {};
    for (const s of sessions) {
      if (s.startTime) {
        const day = s.startTime.getDay();
        const hour = s.startTime.getHours();
        studyByDay[day] = (studyByDay[day] || 0) + 1;
        studyByHour[hour] = (studyByHour[hour] || 0) + 1;
      }
    }

    // Grade trends: recent grade history grouped by course
    const gradeHistory = await prisma.gradeHistory.findMany({
      where: { userId: user.id },
      include: { course: { select: { name: true, code: true } } },
      orderBy: { recordedAt: "asc" },
    });

    const gradeTrends: Record<
      string,
      { courseName: string | null; courseCode: string | null; grades: { score: number | null; pointsPossible: number | null; recordedAt: Date }[] }
    > = {};
    for (const g of gradeHistory) {
      if (!gradeTrends[g.courseId]) {
        gradeTrends[g.courseId] = {
          courseName: g.course.name,
          courseCode: g.course.code,
          grades: [],
        };
      }
      gradeTrends[g.courseId].grades.push({
        score: g.score ? Number(g.score) : null,
        pointsPossible: g.pointsPossible ? Number(g.pointsPossible) : null,
        recordedAt: g.recordedAt,
      });
    }

    return NextResponse.json({
      procrastinationIndex,
      studyPatterns: {
        byDayOfWeek: studyByDay,
        byHour: studyByHour,
        totalSessions: sessions.length,
      },
      gradeTrends: Object.values(gradeTrends),
    });
  } catch (error) {
    console.error("Patterns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
