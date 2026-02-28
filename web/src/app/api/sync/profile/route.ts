import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/sync/profile
 * Updates the user's academic profile info (major, college, class level)
 * from data scraped by the extension from MyRed.
 */
export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { major, college, classLevel, displayName, nuid } = await req.json();

        // Only update fields that are provided and not already set
        const updateData: Record<string, string> = {};
        if (major) updateData.major = major.substring(0, 200);
        if (college) updateData.college = college.substring(0, 200);
        if (classLevel) updateData.classLevel = classLevel.substring(0, 30);
        if (displayName && !user.displayName) updateData.displayName = displayName.substring(0, 100);
        if (nuid && !user.nuid) updateData.nuid = nuid.substring(0, 8);

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true, message: "No updates needed" });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            updated: Object.keys(updateData),
        });
    } catch (error) {
        console.error("[Profile Sync] Error:", error);
        return NextResponse.json(
            { error: "Profile sync failed" },
            { status: 500 }
        );
    }
}
