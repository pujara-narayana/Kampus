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
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const hasDateFilter = from || to;

    const [classes, assignments, events, studySessions] = await Promise.all([
      prisma.classSchedule.findMany({
        where: { userId: user.id },
        orderBy: { startTime: "asc" },
      }),

      prisma.assignment.findMany({
        where: {
          userId: user.id,
          ...(hasDateFilter ? { dueAt: dateFilter } : {}),
        },
        include: { course: { select: { name: true, code: true } } },
        orderBy: { dueAt: "asc" },
      }),

      prisma.event.findMany({
        where: hasDateFilter
          ? { startTime: dateFilter }
          : { startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 100,
      }),

      prisma.studySession.findMany({
        where: {
          OR: [
            { creatorId: user.id },
            { participants: { some: { userId: user.id, status: "accepted" } } },
          ],
          ...(hasDateFilter ? { startTime: dateFilter } : {}),
        },
        include: {
          course: { select: { name: true, code: true } },
          _count: { select: { participants: true } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    return NextResponse.json({
      classes,
      assignments,
      events,
      studySessions,
    });
  } catch (error) {
    console.error("Calendar error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
