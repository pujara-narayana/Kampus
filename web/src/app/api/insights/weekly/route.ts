import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { generateWeeklySummary } from "@/lib/ai";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine the start of the current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Check if a summary already exists for this week
    const existing = await prisma.weeklySummary.findUnique({
      where: {
        userId_weekStart: {
          userId: user.id,
          weekStart,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ summary: existing });
    }

    // Gather stats for the week
    const [assignmentsDue, assignmentsCompleted, behaviors, sessions, eventsThisWeek, freeFoodThisWeek] =
      await Promise.all([
        prisma.assignment.count({
          where: {
            userId: user.id,
            dueAt: { gte: weekStart, lt: weekEnd },
          },
        }),
        prisma.assignment.count({
          where: {
            userId: user.id,
            dueAt: { gte: weekStart, lt: weekEnd },
            hasSubmitted: true,
          },
        }),
        prisma.assignmentBehavior.findMany({
          where: {
            userId: user.id,
            dueAt: { gte: weekStart, lt: weekEnd },
          },
        }),
        // Sessions: created by user OR user is accepted participant (creator may not be in participants)
        prisma.studySession.count({
          where: {
            startTime: { gte: weekStart, lt: weekEnd },
            OR: [
              { creatorId: user.id },
              { participants: { some: { userId: user.id, status: "accepted" } } },
            ],
          },
        }),
        prisma.event.count({
          where: {
            startTime: { gte: weekStart, lt: weekEnd },
          },
        }),
        prisma.event.count({
          where: {
            startTime: { gte: weekStart, lt: weekEnd },
            hasFreeFood: true,
          },
        }),
      ]);

    const avgDaysBeforeDue =
      behaviors.length > 0
        ? behaviors.reduce(
            (sum, b) => sum + (Number(b.daysBeforeDue) || 0),
            0
          ) / behaviors.length
        : 0;

    const totalStudyHours = behaviors.reduce(
      (sum, b) => sum + (Number(b.actualHours) || 0),
      0
    );

    // Events: we have no user→event attendance model, so these are "on campus" counts, not "attended"
    const eventsOnCampus = eventsThisWeek;
    const freeFoodEventsOnCampus = freeFoodThisWeek;

    // Generate AI summary
    const aiSummary = await generateWeeklySummary({
      assignmentsDue,
      assignmentsCompleted,
      avgDaysBeforeDue,
      totalStudyHours,
      sessionsAttended: sessions,
      eventsOnCampus,
      freeFoodEventsOnCampus,
    });

    // Save the summary (store campus event counts; no per-user attendance)
    const summary = await prisma.weeklySummary.create({
      data: {
        userId: user.id,
        weekStart,
        totalAssignmentsDue: assignmentsDue,
        assignmentsCompleted,
        avgDaysBeforeDue,
        totalStudyHours,
        studySessionsAttended: sessions,
        eventsAttended: eventsOnCampus,
        freeFoodEvents: freeFoodEventsOnCampus,
        aiSummary,
      },
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Weekly insights error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
