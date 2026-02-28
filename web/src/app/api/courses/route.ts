import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/courses — Returns the current user's courses with grades (synced by extension).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courses = await prisma.course.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        code: true,
        term: true,
        currentGrade: true,
        currentScore: true,
      },
      orderBy: [{ term: "desc" }, { name: "asc" }],
    });

    const result = courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      term: c.term,
      currentGrade: c.currentGrade,
      currentScore: c.currentScore != null ? Number(c.currentScore) : null,
    }));

    return NextResponse.json({ courses: result });
  } catch (error) {
    console.error("Courses list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
