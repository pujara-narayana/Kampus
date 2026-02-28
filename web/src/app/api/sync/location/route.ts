import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { latitude, longitude, source, timestamp } = await req.json();

        if (!latitude || !longitude) {
            return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
        }

        // Optional: reverse nearest campus building logic could go here
        // For now, raw location log insert
        await prisma.locationLog.create({
            data: {
                userId: user.id,
                source: (source || 'extension').substring(0, 20),
                arrivedAt: timestamp ? new Date(timestamp) : new Date(),
                dayOfWeek: new Date().getDay(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Sync location error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
