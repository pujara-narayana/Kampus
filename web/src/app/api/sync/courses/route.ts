import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courses } = await req.json();

    if (!Array.isArray(courses)) {
      return NextResponse.json(
        { error: "courses must be an array" },
        { status: 400 }
      );
    }

    const results = [];

    for (const c of courses) {
      const course = await prisma.course.upsert({
        where: {
          canvasId_userId: {
            canvasId: BigInt(c.canvasId),
            userId: user.id,
          },
        },
        update: {
          name: c.name ? String(c.name).substring(0, 195) : null,
          code: c.code ? String(c.code).substring(0, 48) : null,
          term: c.term ? String(c.term).substring(0, 48) : null,
          currentGrade: c.currentGrade ? String(c.currentGrade).substring(0, 5) : null,
          currentScore: c.currentScore ?? null,
          syncedAt: new Date(),
        },
        create: {
          canvasId: BigInt(c.canvasId),
          userId: user.id,
          name: c.name ? String(c.name).substring(0, 195) : null,
          code: c.code ? String(c.code).substring(0, 48) : null,
          term: c.term ? String(c.term).substring(0, 48) : null,
          currentGrade: c.currentGrade ? String(c.currentGrade).substring(0, 5) : null,
          currentScore: c.currentScore ?? null,
        },
      });

      // Create UserCourseLink if it doesn't exist
      await prisma.userCourseLink.upsert({
        where: {
          userId_courseId: {
            userId: user.id,
            courseId: course.id,
          },
        },
        update: {
          canvasCourseId: BigInt(c.canvasId),
        },
        create: {
          userId: user.id,
          courseId: course.id,
          canvasCourseId: BigInt(c.canvasId),
        },
      });

      results.push(course.id);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      synced: results.length,
      courseIds: results,
    });
  } catch (error) {
    console.error("Sync courses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
