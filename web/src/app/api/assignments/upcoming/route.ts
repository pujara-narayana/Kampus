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
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const assignments = await prisma.assignment.findMany({
      where: {
        userId: user.id,
        hasSubmitted: false,
        dueAt: { gte: new Date() },
      },
      include: {
        course: { select: { name: true, code: true } },
      },
      orderBy: { dueAt: "asc" },
      take: limit,
    });

    const result = assignments.map((a) => ({
      id: a.id,
      canvasId: a.canvasId.toString(),
      name: a.name,
      dueAt: a.dueAt,
      pointsPossible: a.pointsPossible,
      submissionTypes: a.submissionTypes,
      estimatedHours: a.estimatedHours,
      aiStudyTip: a.aiStudyTip,
      htmlUrl: a.htmlUrl,
      course: a.course,
    }));

    return NextResponse.json({ assignments: result });
  } catch (error) {
    console.error("Upcoming assignments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
