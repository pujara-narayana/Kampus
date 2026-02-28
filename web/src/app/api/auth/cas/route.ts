import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/cas
 * Redirects the user to UNL's CAS login page.
 * After login, CAS redirects back to our callback URL with a ?ticket= param.
 */
export async function GET(req: NextRequest) {
    // Use the actual request origin to handle dynamic ports (3000 vs 3001)
    const origin = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const appUrl = `${protocol}://${origin}`;
    const serviceUrl = `${appUrl}/api/auth/cas/callback`;
    const casLoginUrl = `https://shib.unl.edu/idp/profile/cas/login?service=${encodeURIComponent(serviceUrl)}`;

    return NextResponse.redirect(casLoginUrl);
}
