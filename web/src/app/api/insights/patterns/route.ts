import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** Parse term like "Spring 2026" or "Fall 2025" to a sort key (higher = more recent). */
function termSortKey(term: string | null): number {
  if (!term || !term.trim()) return 0;
  const s = term.trim();
  const yearMatch = s.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  const lower = s.toLowerCase();
  let season = 0;
  if (lower.includes("spring")) season = 1;
  else if (lower.includes("summer")) season = 2;
  else if (lower.includes("fall")) season = 3;
  return year * 10 + season;
}

/** Given sorted unique dates (YYYY-MM-DD), compute current and longest consecutive-day streak. */
function streakFromDates(dates: string[]): { currentCount: number; longestCount: number } {
  if (dates.length === 0) return { currentCount: 0, longestCount: 0 };
  const today = new Date().toISOString().slice(0, 10);
  let current = 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]).getTime();
    const curr = new Date(dates[i]).getTime();
    const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  // Current: count back from today
  if (dates.includes(today)) {
    current = 1;
    const idx = dates.indexOf(today);
    for (let i = idx; i > 0; i--) {
      const curr = new Date(dates[i]).getTime();
      const prev = new Date(dates[i - 1]).getTime();
      if (Math.round((curr - prev) / (24 * 60 * 60 * 1000)) === 1) current += 1;
      else break;
    }
  }
  return { currentCount: current, longestCount: Math.max(longest, current) };
}

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
      select: {
        startTime: true,
        creatorId: true,
        participants: { where: { status: "accepted" }, select: { userId: true } },
      },
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

    // Streaks: from DB and computed from activity
    const dbStreaks = await prisma.streak.findMany({
      where: { userId: user.id },
    });
    const dbByType = new Map(dbStreaks.map((s) => [s.type, s]));

    const studyDates = [
      ...new Set(
        sessions
          .filter((s) => s.startTime)
          .map((s) => s.startTime!.toISOString().slice(0, 10))
      ),
    ].sort();
    const dailyStudyComputed = streakFromDates(studyDates);

    const socialDates = [
      ...new Set(
        sessions
          .filter(
            (s) =>
              s.startTime &&
              s.participants.length >= 2 &&
              (s.creatorId === user.id ||
                s.participants.some((p) => p.userId === user.id))
          )
          .map((s) => s.startTime!.toISOString().slice(0, 10))
      ),
    ].sort();
    const socialStudyComputed = streakFromDates(socialDates);

    const onTimeBehaviors = behaviors.filter(
      (b) =>
        b.submittedAt &&
        b.dueAt &&
        new Date(b.submittedAt).getTime() <= new Date(b.dueAt).getTime()
    );
    const onTimeDates = [
      ...new Set(
        onTimeBehaviors
          .map((b) => new Date(b.submittedAt!).toISOString().slice(0, 10))
      ),
    ].sort();
    const onTimeComputed = streakFromDates(onTimeDates);

    const streakTypes = [
      { type: "daily_study", computed: dailyStudyComputed },
      { type: "on_time_submission", computed: onTimeComputed },
      { type: "social_study", computed: socialStudyComputed },
    ] as const;
    const streaks = streakTypes
      .map(({ type, computed }) => {
        const db = dbByType.get(type);
        return {
          type,
          currentCount: computed.currentCount,
          longestCount: Math.max(
            computed.longestCount,
            db?.longestCount ?? 0
          ),
        };
      })
      .filter((s) => s.currentCount > 0 || s.longestCount > 0);

    // Grade trends: start from user's courses (so we show current grade from extension sync)
    const userCourses = await prisma.course.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        code: true,
        term: true,
        currentGrade: true,
        currentScore: true,
      },
    });

    const gradeHistory = await prisma.gradeHistory.findMany({
      where: { userId: user.id },
      orderBy: { recordedAt: "asc" },
    });

    const gradeTrendsMap: Record<
      string,
      {
        courseName: string | null;
        courseCode: string | null;
        term: string | null;
        currentGrade: string | null;
        currentScore: number | null;
        grades: { score: number | null; pointsPossible: number | null; recordedAt: Date }[];
      }
    > = {};

    for (const c of userCourses) {
      gradeTrendsMap[c.id] = {
        courseName: c.name,
        courseCode: c.code,
        term: c.term,
        currentGrade: c.currentGrade,
        currentScore: c.currentScore != null ? Number(c.currentScore) : null,
        grades: [],
      };
    }
    for (const g of gradeHistory) {
      if (!gradeTrendsMap[g.courseId]) {
        continue;
      }
      gradeTrendsMap[g.courseId].grades.push({
        score: g.score ? Number(g.score) : null,
        pointsPossible: g.pointsPossible ? Number(g.pointsPossible) : null,
        recordedAt: g.recordedAt,
      });
    }

    // Same as dashboard: only courses with a grade, then order by term (newest first), then by name
    const gradeTrends = Object.values(gradeTrendsMap)
      .filter(
        (c) => c.currentGrade != null || c.currentScore != null
      )
      .sort((a, b) => {
        const termDiff = termSortKey(b.term) - termSortKey(a.term);
        if (termDiff !== 0) return termDiff;
        const nameA = (a.courseName || a.courseCode || "").toLowerCase();
        const nameB = (b.courseName || b.courseCode || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });

    return NextResponse.json({
      procrastinationIndex,
      studyPatterns: {
        byDayOfWeek: studyByDay,
        byHour: studyByHour,
        totalSessions: sessions.length,
      },
      studySessionsAttended: sessions.length,
      streaks,
      gradeTrends,
    });
  } catch (error) {
    console.error("Patterns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
