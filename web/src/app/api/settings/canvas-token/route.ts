import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/settings/canvas-token
 * Save the user's Canvas personal access token.
 */
export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Quick validation — try a Canvas API call
    try {
        const res = await fetch("https://canvas.unl.edu/api/v1/users/self", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            return NextResponse.json(
                { error: "Invalid Canvas token. Please generate a new one at canvas.unl.edu/profile/settings" },
                { status: 400 }
            );
        }
    } catch {
        return NextResponse.json(
            { error: "Could not connect to Canvas. Please try again." },
            { status: 502 }
        );
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { canvasToken: token },
    });

    return NextResponse.json({ success: true, message: "Canvas token saved" });
}

/**
 * DELETE /api/settings/canvas-token
 * Remove the user's Canvas token.
 */
export async function DELETE(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { canvasToken: null },
    });

    return NextResponse.json({ success: true, message: "Canvas token removed" });
}
