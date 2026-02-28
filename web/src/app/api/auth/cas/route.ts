import { NextResponse } from "next/server";

/**
 * GET /api/auth/cas
 * Redirects the user to UNL's CAS login page.
 * After login, CAS redirects back to our callback URL with a ?ticket= param.
 */
export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const serviceUrl = `${appUrl}/api/auth/cas/callback`;
    const casLoginUrl = `https://shib.unl.edu/idp/profile/cas/login?service=${encodeURIComponent(serviceUrl)}`;

    return NextResponse.redirect(casLoginUrl);
}
