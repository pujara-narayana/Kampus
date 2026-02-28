import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Returns the current user profile for CAS token-based login.
 */
export async function GET(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            nuid: user.nuid,
            avatarUrl: user.avatarUrl,
        },
    });
}
