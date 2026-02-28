import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const user = await prisma.user.findFirst({ where: { email: "smohanty13@huskers.unl.edu" } });
    if (!user) { return NextResponse.json({ error: "User not found" }); }

    const sched = await prisma.classSchedule.findMany({ where: { userId: user.id } });

    return NextResponse.json({
        googleToken: user.googleToken ? "Exists" : "None",
        googleTokenRaw: user.googleToken,
        scheduleCount: sched.length,
        scheduleSample: sched,
    });
}
