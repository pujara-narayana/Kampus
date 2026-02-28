import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getAuthUser } from "@/lib/auth";
import { getAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar";

const JWT_SECRET = process.env.JWT_SECRET || "kampus-dev-secret-change-in-prod";

/**
 * GET /api/gcal/auth
 * Returns the Google OAuth URL. Frontend should redirect the user there.
 * Requires: Authorization: Bearer <jwt>
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar is not configured" },
      { status: 503 }
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/gcal/callback`;
  const state = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: "10m" }
  );

  const redirectUrl = getAuthUrl(state, redirectUri);
  return NextResponse.json({ redirectUrl });
}
