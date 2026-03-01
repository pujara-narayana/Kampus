import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/** Canvas IDs used by the demo seed (courses 10001–10005, assignments 20001–20009). */
const DEMO_COURSE_CANVAS_IDS = [10001, 10002, 10003, 10004, 10005].map(
  (n) => BigInt(n)
);
const DEMO_EVENT_SOURCE_IDS = [
  "ev-001",
  "ev-002",
  "ev-003",
  "ev-004",
  "ev-005",
  "ev-006",
  "ev-007",
  "ev-008",
];

/** Demo friend emails — connections to these users are removed when clearing demo data. */
const DEMO_FRIEND_EMAILS = [
  "test@kampus.demo",
  "alex@kampus.demo",
  "jordan@kampus.demo",
  "sam@kampus.demo",
  "morgan@kampus.demo",
  "casey@kampus.demo",
];

/**
 * POST /api/seed/clear — Removes demo data for the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const demoCourses = await prisma.course.findMany({
      where: {
        userId: user.id,
        canvasId: { in: DEMO_COURSE_CANVAS_IDS },
      },
      select: { id: true },
    });
    const demoCourseIds = demoCourses.map((c) => c.id);

    if (demoCourseIds.length > 0) {
      const demoSessionIds = await prisma.studySession
        .findMany({
          where: { courseId: { in: demoCourseIds } },
          select: { id: true },
        })
        .then((s) => s.map((x) => x.id));

      if (demoSessionIds.length > 0) {
        await prisma.sessionParticipant.deleteMany({
          where: { sessionId: { in: demoSessionIds } },
        });
      }
      await prisma.studySession.deleteMany({
        where: { courseId: { in: demoCourseIds } },
      });
      await prisma.assignmentBehavior.deleteMany({
        where: {
          userId: user.id,
          assignment: { courseId: { in: demoCourseIds } },
        },
      });
      await prisma.userCourseLink.deleteMany({
        where: { userId: user.id, courseId: { in: demoCourseIds } },
      });
      await prisma.course.deleteMany({
        where: { id: { in: demoCourseIds } },
      });
    }

    await prisma.classSchedule.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.streak.deleteMany({ where: { userId: user.id } });
    await prisma.feedItem.deleteMany({ where: { userId: user.id } });
    await prisma.weeklySummary.deleteMany({ where: { userId: user.id } });

    // Remove connections between current user and demo friend accounts
    const demoUserIds = await prisma.user
      .findMany({
        where: { email: { in: DEMO_FRIEND_EMAILS } },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));
    if (demoUserIds.length > 0) {
      await prisma.connection.deleteMany({
        where: {
          OR: [
            { requesterId: user.id, receiverId: { in: demoUserIds } },
            { receiverId: user.id, requesterId: { in: demoUserIds } },
          ],
        },
      });
    }

    await prisma.event.deleteMany({
      where: { sourceId: { in: DEMO_EVENT_SOURCE_IDS } },
    });

    return NextResponse.json({
      message: "Demo data cleared.",
      cleared: {
        courses: demoCourseIds.length,
        schedule: true,
        notifications: true,
        streaks: true,
        feedItems: true,
        weeklySummary: true,
        connections: demoUserIds?.length ?? 0,
        events: true,
      },
    });
  } catch (error) {
    console.error("Seed clear error:", error);
    return NextResponse.json(
      {
        error:
          "Clear failed: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
