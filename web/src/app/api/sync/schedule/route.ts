import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { classes } = await req.json();

    if (!Array.isArray(classes)) {
      return NextResponse.json(
        { error: "classes must be an array" },
        { status: 400 }
      );
    }

    // Replace entire schedule: delete all existing, then insert synced classes
    await prisma.classSchedule.deleteMany({
      where: { userId: user.id },
    });

    const created = await prisma.classSchedule.createMany({
      data: classes.map((c: Record<string, unknown>) => ({
        userId: user.id,
        courseCode: (c.courseCode as string) || null,
        courseTitle: (c.courseTitle as string) || null,
        days: (c.days as string) || null,
        startTime: (c.startTime as string) || null,
        endTime: (c.endTime as string) || null,
        building: (c.building as string) || null,
        room: (c.room as string) || null,
        buildingLat: (c.buildingLat as number) ?? null,
        buildingLng: (c.buildingLng as number) ?? null,
        instructor: (c.instructor as string) || null,
        term: (c.term as string) || null,
      })),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ synced: created.count });
  } catch (error) {
    console.error("Sync schedule error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
