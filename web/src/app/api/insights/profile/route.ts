import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { generateBehavioralInsight, type BehavioralInsightOutput } from "@/lib/ai";

// ---- Types ------------------------------------------------------------------

type BehaviorProfile =
  | "early_planner"
  | "deadline_sprinter"
  | "social_learner"
  | "solo_grinder"
  | "balanced_achiever";

interface ProfileSignals {
  avgDaysBeforeDue: number;
  procrastinationIndex: number;
  groupSessionRatio: number;
  soloRatio: number;
  estimationAccuracy: number;
  avgCourseScore: number | null;
  gradeVariance: number;
  weeklyStudyHours: number;
  totalBehaviors: number;
  totalSessions: number;
}

interface AcademicAlert {
  type: "declining_grades" | "procrastination_warning" | "completion_risk";
  severity: "info" | "warning" | "critical";
  message: string;
  courseId?: string;
  courseName?: string;
}

interface Recommendation {
  type: "study_session" | "campus_event" | "create_solo_session" | "review_course";
  id: string;
  title: string;
  startTime: string | null;
  engagementProbability: number;
  academicUplift: number;
  score: number;
  reason: string;
  sessionId?: string;
  eventId?: string;
  courseId?: string;
}

// ---- Profile classification -------------------------------------------------

function classifyProfile(s: ProfileSignals): { profile: BehaviorProfile; confidence: number } {
  const scores: Record<BehaviorProfile, number> = {
    early_planner: 0,
    deadline_sprinter: 0,
    social_learner: 0,
    solo_grinder: 0,
    balanced_achiever: 0,
  };

  if (s.avgDaysBeforeDue >= 4) scores.early_planner += 1.5;
  else if (s.avgDaysBeforeDue >= 2) scores.early_planner += 0.7;
  if (s.procrastinationIndex < 0.3) scores.early_planner += 1.2;
  if (s.estimationAccuracy > 0.7) scores.early_planner += 0.6;

  if (s.procrastinationIndex >= 0.65) scores.deadline_sprinter += 1.5;
  if (s.avgDaysBeforeDue < 1) scores.deadline_sprinter += 1.2;
  if (s.estimationAccuracy < 0.35) scores.deadline_sprinter += 0.5;

  if (s.groupSessionRatio >= 0.55 && s.totalSessions >= 2) scores.social_learner += 2.0;
  if (s.groupSessionRatio >= 0.75) scores.social_learner += 0.5;

  if (s.soloRatio >= 0.7 && s.totalSessions >= 2) scores.solo_grinder += 2.0;
  if (s.weeklyStudyHours > 3 && s.soloRatio >= 0.6) scores.solo_grinder += 0.5;

  const modProc = s.procrastinationIndex >= 0.3 && s.procrastinationIndex < 0.6;
  const modGroup = s.groupSessionRatio >= 0.3 && s.groupSessionRatio <= 0.65;
  const modEarly = s.avgDaysBeforeDue >= 1 && s.avgDaysBeforeDue < 4;
  if (modProc) scores.balanced_achiever += 1.0;
  if (modGroup) scores.balanced_achiever += 1.0;
  if (modEarly) scores.balanced_achiever += 1.0;

  const top = (Object.entries(scores) as [BehaviorProfile, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const totalScore = top.reduce((s, [, v]) => s + v, 0);
  const confidence = totalScore > 0 ? Math.min(0.95, top[0][1] / Math.max(totalScore, 1)) : 0.2;

  return { profile: top[0][0], confidence };
}

// ---- Strengths & improvements per profile -----------------------------------

const PROFILE_DETAILS: Record<
  BehaviorProfile,
  { strengths: string[]; improvements: string[] }
> = {
  early_planner: {
    strengths: [
      "Consistently starts assignments well before deadlines",
      "Lower stress from proactive approach",
      "Strong time estimation and planning skills",
    ],
    improvements: [
      "Consider joining group study sessions for richer perspectives",
      "Keep balancing solo depth with collaborative breadth",
    ],
  },
  deadline_sprinter: {
    strengths: [
      "Efficient and high-output when focused under time pressure",
      "Resilient under deadline stress",
    ],
    improvements: [
      "Start assignments 3+ days early to improve quality and reduce anxiety",
      "Break large projects into daily milestones",
      "Join mid-week study sessions to build momentum before crunch time",
    ],
  },
  social_learner: {
    strengths: [
      "Thrives in collaborative study environments",
      "Builds strong peer networks that reinforce learning",
      "Group work boosts comprehension and retention",
    ],
    improvements: [
      "Balance group sessions with focused individual review",
      "Make sure group sessions stay on topic with a clear agenda",
    ],
  },
  solo_grinder: {
    strengths: [
      "Self-motivated and independent learner",
      "Deep focus and strong work ethic",
      "High study frequency demonstrates discipline",
    ],
    improvements: [
      "Try group sessions to gain different perspectives and catch blind spots",
      "Peer explanation is one of the most powerful learning techniques",
    ],
  },
  balanced_achiever: {
    strengths: [
      "Versatile study approach — comfortable solo and in groups",
      "Steady academic engagement across multiple courses",
    ],
    improvements: [
      "Lean into your strongest study mode when facing tough material",
      "Track which study types correlate best with your grade outcomes",
    ],
  },
};

// ---- Academic alert detection -----------------------------------------------

function buildAlerts(
  behaviors: Array<{ procrastinationScore: unknown; daysBeforeDue: unknown; submittedAt: Date | null }>,
  gradeHistory: Array<{ courseId: string; score: unknown; recordedAt: Date }>,
  courses: Array<{ id: string; name: string | null; code: string | null }>,
  upcomingAssignments: Array<{ dueAt: Date | null }>,
  procrastinationIndex: number
): AcademicAlert[] {
  const alerts: AcademicAlert[] = [];

  // 1. Declining grades per course (need 3+ history entries, trend downward)
  const historyByCourse = new Map<string, Array<{ score: number; recordedAt: Date }>>();
  for (const g of gradeHistory) {
    if (g.score === null || g.score === undefined) continue;
    const scoreNum = Number(g.score);
    if (isNaN(scoreNum)) continue;
    if (!historyByCourse.has(g.courseId)) historyByCourse.set(g.courseId, []);
    historyByCourse.get(g.courseId)!.push({ score: scoreNum, recordedAt: g.recordedAt });
  }

  for (const [courseId, entries] of historyByCourse.entries()) {
    const sorted = [...entries].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    if (sorted.length < 3) continue;
    const last3 = sorted.slice(-3).map((e) => e.score);
    const isDecline = last3[2] < last3[1] && last3[1] < last3[0];
    const drop = last3[0] - last3[2];
    if (isDecline && drop >= 5) {
      const course = courses.find((c) => c.id === courseId);
      alerts.push({
        type: "declining_grades",
        severity: drop >= 15 ? "critical" : "warning",
        message: `Your grade in ${course?.name || course?.code || "a course"} has dropped ${drop.toFixed(0)} points over recent assessments.`,
        courseId,
        courseName: course?.name || course?.code || undefined,
      });
    }
  }

  // 2. Procrastination warning
  if (procrastinationIndex >= 0.72 && behaviors.length >= 3) {
    alerts.push({
      type: "procrastination_warning",
      severity: procrastinationIndex >= 0.88 ? "critical" : "warning",
      message: `Your procrastination index is ${(procrastinationIndex * 100).toFixed(0)}% — you're starting assignments very close to deadlines, which increases errors and stress.`,
    });
  }

  // 3. Completion risk: 2+ assignments due in the next 48 hours
  const now = Date.now();
  const urgentCount = upcomingAssignments.filter((a) => {
    if (!a.dueAt) return false;
    return a.dueAt.getTime() - now <= 48 * 60 * 60 * 1000;
  }).length;

  if (urgentCount >= 2) {
    alerts.push({
      type: "completion_risk",
      severity: urgentCount >= 4 ? "critical" : "warning",
      message: `You have ${urgentCount} assignment${urgentCount === 1 ? "" : "s"} due within the next 48 hours.`,
    });
  }

  return alerts.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

// ---- Recommendation scoring --------------------------------------------------

function buildRecommendations(
  profile: BehaviorProfile,
  signals: ProfileSignals,
  availableSessions: Array<{
    id: string;
    title: string | null;
    startTime: Date | null;
    courseId: string | null;
    participantCount: number;
    courseName: string | null;
  }>,
  upcomingEvents: Array<{
    id: string;
    title: string | null;
    startTime: Date | null;
    eventType: string | null;
    hasFreeFood: boolean;
  }>,
  decliningCourseIds: Set<string>,
  decliningCourses: Array<{ id: string; name: string | null; code: string | null }>,
  upcomingAssignments: Array<{ dueAt: Date | null; name: string | null; courseId: string | null }>
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Study sessions
  for (const s of availableSessions.slice(0, 12)) {
    let ep = 0.3; // engagement probability base
    let au = 0.3; // academic uplift base

    const isGroup = s.participantCount >= 2;
    const isDecliningCourse = s.courseId ? decliningCourseIds.has(s.courseId) : false;

    if (profile === "social_learner" && isGroup) ep += 0.25;
    else if (profile === "solo_grinder" && !isGroup) ep += 0.15;
    else if (isGroup) ep += 0.08;

    if (isDecliningCourse) { ep += 0.20; au += 0.30; }
    if (s.courseId) au += 0.10;

    const hasUrgentDeadline = upcomingAssignments.some(
      (a) =>
        a.courseId === s.courseId &&
        a.dueAt &&
        a.dueAt.getTime() - Date.now() < 72 * 60 * 60 * 1000
    );
    if (hasUrgentDeadline) { ep += 0.15; au += 0.15; }

    ep = Math.min(0.95, ep);
    au = Math.min(0.92, au);

    recs.push({
      type: "study_session",
      id: `session_${s.id}`,
      title: s.title || "Study Session",
      startTime: s.startTime ? s.startTime.toISOString() : null,
      engagementProbability: ep,
      academicUplift: au,
      score: ep + au,
      reason: isDecliningCourse
        ? `Your grade in ${s.courseName || "this course"} is declining — this session targets exactly what you need.`
        : hasUrgentDeadline
        ? `You have a deadline approaching in this course — studying now will help.`
        : isGroup
        ? "Collaborative sessions reinforce understanding and build peer connections."
        : "A focused solo session to tackle your current workload.",
      sessionId: s.id,
      courseId: s.courseId || undefined,
    });
  }

  // Events
  for (const e of upcomingEvents.slice(0, 10)) {
    let ep = 0.22;
    let au = 0.08;

    if (e.hasFreeFood) ep += profile === "social_learner" ? 0.30 : 0.18;
    const etype = (e.eventType || "").toLowerCase();
    if (etype.includes("academic") || etype.includes("workshop")) { ep += 0.18; au += 0.28; }
    if (etype.includes("career") || etype.includes("networking")) { ep += 0.15; au += 0.12; }
    if (etype.includes("social") || etype.includes("cultural")) {
      ep += profile === "social_learner" ? 0.25 : 0.08;
    }

    ep = Math.min(0.90, ep);
    au = Math.min(0.65, au);

    recs.push({
      type: "campus_event",
      id: `event_${e.id}`,
      title: e.title || "Campus Event",
      startTime: e.startTime ? e.startTime.toISOString() : null,
      engagementProbability: ep,
      academicUplift: au,
      score: ep + au,
      reason: e.hasFreeFood
        ? "Free food + a chance to recharge and meet people — the perfect study break."
        : etype.includes("academic")
        ? "Academic events and workshops often connect directly to coursework."
        : "Campus engagement beyond the classroom strengthens your overall experience.",
      eventId: e.id,
    });
  }

  // Synthetic "start early" recommendation for deadline sprinters
  if (profile === "deadline_sprinter" && upcomingAssignments.length > 0) {
    const next = upcomingAssignments[0];
    const daysLeft = next.dueAt
      ? (next.dueAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      : null;
    if (daysLeft !== null && daysLeft > 0.5) {
      recs.push({
        type: "create_solo_session",
        id: "start_early_1",
        title: `Start "${next.name || "upcoming assignment"}" today`,
        startTime: null,
        engagementProbability: 0.6,
        academicUplift: 0.72,
        score: 1.32,
        reason: `Due in ${daysLeft.toFixed(0)} day${daysLeft >= 2 ? "s" : ""}. Starting now instead of at the last minute can improve your score by 10–15%.`,
        courseId: next.courseId || undefined,
      });
    }
  }

  // Review declining courses
  for (const course of decliningCourses.slice(0, 2)) {
    recs.push({
      type: "review_course",
      id: `review_${course.id}`,
      title: `Review ${course.code || course.name || "declining course"}`,
      startTime: null,
      engagementProbability: 0.62,
      academicUplift: 0.75,
      score: 1.37,
      reason: `Your grade trend in ${course.name || course.code || "this course"} is declining. Focused review of recent material can reverse this quickly.`,
      courseId: course.id,
    });
  }

  // Sort by score desc, return top 6
  return recs.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ---- Main handler -----------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for cached profile (4-hour TTL)
    const existing = await prisma.userBehaviorProfile.findUnique({
      where: { userId: user.id },
    });
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    if (existing && existing.computedAt > fourHoursAgo) {
      const coaching = existing.coachingInsight
        ? (JSON.parse(existing.coachingInsight) as BehavioralInsightOutput)
        : { headline: "", tip: "", motivation: "" };
      return NextResponse.json({
        profile: existing.profile,
        confidence: Number(existing.confidence),
        signals: existing.signals,
        alerts: existing.alerts,
        recommendations: existing.recommendations,
        coaching,
        computedAt: existing.computedAt.toISOString(),
        cached: true,
      });
    }

    // Load behavioral data
    const [behaviors, sessions, gradeHistory, courses, upcomingAssignments, upcomingEvents, submittedAssignments] =
      await Promise.all([
        prisma.assignmentBehavior.findMany({
          where: { userId: user.id },
          orderBy: { dueAt: "desc" },
          take: 60,
        }),
        prisma.studySession.findMany({
          where: {
            OR: [
              { creatorId: user.id },
              { participants: { some: { userId: user.id, status: "accepted" } } },
            ],
          },
          select: {
            startTime: true,
            participants: { where: { status: "accepted" }, select: { userId: true } },
          },
          orderBy: { startTime: "desc" },
          take: 100,
        }),
        prisma.gradeHistory.findMany({
          where: { userId: user.id },
          orderBy: { recordedAt: "asc" },
        }),
        prisma.course.findMany({
          where: { userId: user.id },
          select: { id: true, name: true, code: true, currentScore: true },
        }),
        prisma.assignment.findMany({
          where: { userId: user.id, hasSubmitted: false, dueAt: { gte: new Date() } },
          orderBy: { dueAt: "asc" },
          take: 20,
          select: { id: true, name: true, dueAt: true, courseId: true },
        }),
        prisma.event.findMany({
          where: { startTime: { gte: new Date() } },
          orderBy: { startTime: "asc" },
          take: 30,
          select: { id: true, title: true, startTime: true, eventType: true, hasFreeFood: true },
        }),
        // Past submitted assignments — used to synthesize behavioral signals when
        // AssignmentBehavior records are sparse (e.g. extension not used yet)
        prisma.assignment.findMany({
          where: {
            userId: user.id,
            hasSubmitted: true,
            submittedAt: { not: null },
            dueAt: { not: null },
          },
          select: { id: true, submittedAt: true, dueAt: true, estimatedHours: true, actualHours: true },
          orderBy: { dueAt: "desc" },
          take: 60,
        }),
      ]);

    // Synthesize behavior records from submitted assignments for users whose
    // AssignmentBehavior table is sparse (Canvas data but not extension-tracked).
    const trackedAssignmentIds = new Set(behaviors.map((b) => b.assignmentId).filter(Boolean));
    const syntheticBehaviors = submittedAssignments
      .filter((a) => !trackedAssignmentIds.has(a.id))
      .map((a) => {
        const msBeforeDue =
          a.dueAt && a.submittedAt ? a.dueAt.getTime() - a.submittedAt.getTime() : null;
        const daysBeforeDue = msBeforeDue !== null ? msBeforeDue / (24 * 60 * 60 * 1000) : null;
        // procrastination: 0 = submitted day-of, 1 = submitted 7+ days early
        // (inverted so high score = procrastinating, matching existing convention)
        const procrastinationScore =
          daysBeforeDue !== null
            ? Math.max(0, Math.min(1, Math.max(0, 7 - daysBeforeDue) / 7))
            : null;
        return {
          procrastinationScore,
          daysBeforeDue,
          submittedAt: a.submittedAt,
          estimatedHours: a.estimatedHours ? Number(a.estimatedHours) : null,
          actualHours: a.actualHours ? Number(a.actualHours) : null,
          dueAt: a.dueAt,
        };
      });

    // Unified behavior-like records for signal computation
    interface EffectiveBehavior {
      procrastinationScore: unknown;
      daysBeforeDue: unknown;
      submittedAt: Date | null;
      estimatedHours: unknown;
      actualHours: unknown;
      dueAt: Date | null;
    }
    const effectiveBehaviors: EffectiveBehavior[] = [...behaviors, ...syntheticBehaviors];

    // Insufficient data across all sources
    if (effectiveBehaviors.length < 3) {
      const coaching: BehavioralInsightOutput = {
        headline: "You're just getting started — keep studying to unlock your profile!",
        tip: "Complete a few more assignments and join a study session to see your behavioral analytics.",
        motivation: "Every step forward counts. You've got this! 🚀",
      };
      return NextResponse.json({
        profile: "balanced_achiever",
        confidence: 0.2,
        signals: { totalBehaviors: effectiveBehaviors.length, totalSessions: sessions.length },
        alerts: [],
        recommendations: [],
        coaching,
        computedAt: new Date().toISOString(),
      });
    }

    // ---- Compute feature signals ----
    const withProc = effectiveBehaviors.filter((b) => b.procrastinationScore !== null);
    const procrastinationIndex =
      withProc.length > 0
        ? withProc.reduce((s, b) => s + Number(b.procrastinationScore), 0) / withProc.length
        : 0;

    const withDays = effectiveBehaviors.filter((b) => b.daysBeforeDue !== null);
    const avgDaysBeforeDue =
      withDays.length > 0
        ? withDays.reduce((s, b) => s + Number(b.daysBeforeDue), 0) / withDays.length
        : 0;

    const withBothHours = effectiveBehaviors.filter(
      (b) =>
        b.estimatedHours !== null &&
        b.actualHours !== null &&
        Number(b.estimatedHours) > 0
    );
    const estimationAccuracy =
      withBothHours.length > 0
        ? withBothHours.reduce((s, b) => {
            const est = Number(b.estimatedHours);
            const act = Number(b.actualHours);
            return s + (1 - Math.min(1, Math.abs(est - act) / est));
          }, 0) / withBothHours.length
        : 0.5;

    const weeklyStudyHours =
      effectiveBehaviors.length > 0
        ? effectiveBehaviors.reduce((s, b) => s + Number(b.actualHours || 0), 0) /
          Math.max(1, effectiveBehaviors.length / 4) // rough weekly average
        : 0;

    const totalSessions = sessions.length;
    const groupSessions = sessions.filter((s) => s.participants.length >= 2).length;
    const soloSessions = sessions.filter((s) => s.participants.length <= 1).length;
    const groupSessionRatio = totalSessions > 0 ? groupSessions / totalSessions : 0.5;
    const soloRatio = totalSessions > 0 ? soloSessions / totalSessions : 0.5;

    const coursesWithScores = courses.filter((c) => c.currentScore !== null);
    const avgCourseScore =
      coursesWithScores.length > 0
        ? coursesWithScores.reduce((s, c) => s + Number(c.currentScore), 0) /
          coursesWithScores.length
        : null;
    const gradeVariance =
      avgCourseScore !== null && coursesWithScores.length > 1
        ? coursesWithScores.reduce(
            (s, c) => s + Math.pow(Number(c.currentScore) - avgCourseScore, 2),
            0
          ) / coursesWithScores.length
        : 0;

    const signals: ProfileSignals = {
      avgDaysBeforeDue: Math.round(avgDaysBeforeDue * 10) / 10,
      procrastinationIndex: Math.round(procrastinationIndex * 100) / 100,
      groupSessionRatio: Math.round(groupSessionRatio * 100) / 100,
      soloRatio: Math.round(soloRatio * 100) / 100,
      estimationAccuracy: Math.round(estimationAccuracy * 100) / 100,
      avgCourseScore: avgCourseScore !== null ? Math.round(avgCourseScore * 10) / 10 : null,
      gradeVariance: Math.round(gradeVariance * 10) / 10,
      weeklyStudyHours: Math.round(weeklyStudyHours * 10) / 10,
      totalBehaviors: effectiveBehaviors.length,
      totalSessions,
    };

    // ---- Classify profile ----
    const { profile, confidence } = classifyProfile(signals);

    // ---- Detect academic alerts ----
    const alerts = buildAlerts(
      effectiveBehaviors as Parameters<typeof buildAlerts>[0],
      gradeHistory,
      courses,
      upcomingAssignments,
      procrastinationIndex
    );

    // ---- Load candidate sessions for recommendations ----
    const candidateSessions = await prisma.studySession.findMany({
      where: {
        isPublic: true,
        status: { in: ["upcoming", "active"] },
        startTime: { gte: new Date() },
        creatorId: { not: user.id },
        participants: { none: { userId: user.id } },
      },
      include: {
        participants: { where: { status: "accepted" }, select: { userId: true } },
        course: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startTime: "asc" },
      take: 15,
    });

    const decliningCourses = alerts
      .filter((a) => a.type === "declining_grades" && a.courseId)
      .map((a) => courses.find((c) => c.id === a.courseId)!)
      .filter(Boolean);
    const decliningCourseIds = new Set(decliningCourses.map((c) => c.id));

    const sessionDataForRec = candidateSessions.map((s) => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime,
      courseId: s.courseId,
      participantCount: s.participants.length,
      courseName: s.course?.name || s.course?.code || null,
    }));

    const recommendations = buildRecommendations(
      profile,
      signals,
      sessionDataForRec,
      upcomingEvents,
      decliningCourseIds,
      decliningCourses,
      upcomingAssignments
    );

    // ---- Generate AI coaching insight ----
    const coaching = await generateBehavioralInsight({
      profile,
      confidence,
      avgDaysBeforeDue: signals.avgDaysBeforeDue,
      procrastinationIndex: signals.procrastinationIndex,
      weeklyStudyHours: signals.weeklyStudyHours,
      groupSessionRatio: signals.groupSessionRatio,
      avgCourseScore: signals.avgCourseScore,
      alerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message })),
    });

    // ---- Cache in DB ----
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toJson = (v: unknown) => v as any;
    await prisma.userBehaviorProfile.upsert({
      where: { userId: user.id },
      update: {
        profile,
        confidence,
        signals: toJson(signals),
        alerts: toJson(alerts),
        recommendations: toJson(recommendations),
        coachingInsight: JSON.stringify(coaching),
        computedAt: new Date(),
      },
      create: {
        userId: user.id,
        profile,
        confidence,
        signals: toJson(signals),
        alerts: toJson(alerts),
        recommendations: toJson(recommendations),
        coachingInsight: JSON.stringify(coaching),
      },
    });

    return NextResponse.json({
      profile,
      confidence,
      signals,
      alerts,
      recommendations,
      coaching,
      computedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Behavior profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
