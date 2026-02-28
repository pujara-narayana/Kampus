import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import {
  getTokensFromCode,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";

const JWT_SECRET = process.env.JWT_SECRET || "kampus-dev-secret-change-in-prod";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/gcal/callback?code=...&state=...
 * OAuth callback from Google. Exchanges code for tokens and saves to user.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/calendar?gcal=error&message=${encodeURIComponent(error)}`
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/calendar?gcal=error&message=missing_code_or_state`
    );
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/calendar?gcal=error&message=not_configured`
    );
  }

  let userId: string;
  try {
    const payload = jwt.verify(state, JWT_SECRET) as { userId: string };
    userId = payload.userId;
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/calendar?gcal=error&message=invalid_state`
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/gcal/callback`;

  const tokens = await getTokensFromCode(code, redirectUri);

  // Get Google profile for google_id (optional, we can use sub from token decode later)
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleToken: tokens as object,
      // googleId can be set when we decode the id_token; for now tokens are enough
    },
  });

  return NextResponse.redirect(
    `${APP_URL}/dashboard/calendar?gcal=connected`
  );
}
