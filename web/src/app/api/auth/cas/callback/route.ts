import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

/**
 * GET /api/auth/cas/callback?ticket=...
 *
 * CAS redirects here after the user authenticates.
 * We validate the ticket with UNL's CAS server, extract the username,
 * upsert a User record, sign a JWT, and redirect to the dashboard.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const ticket = searchParams.get("ticket");

    // Use the actual request origin to handle dynamic ports
    const origin = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const appUrl = `${protocol}://${origin}`;

    if (!ticket) {
        return NextResponse.redirect(`${appUrl}/login?error=no_ticket`);
    }

    const serviceUrl = `${appUrl}/api/auth/cas/callback`;

    // Validate ticket with UNL CAS server
    const validateUrl = `https://shib.unl.edu/idp/profile/cas/serviceValidate?ticket=${encodeURIComponent(ticket)}&service=${encodeURIComponent(serviceUrl)}`;

    try {
        const casRes = await fetch(validateUrl);
        const xml = await casRes.text();

        // Parse the CAS XML response to extract the username
        // CAS returns: <cas:serviceResponse><cas:authenticationSuccess><cas:user>USERNAME</cas:user>...
        const userMatch = xml.match(/<cas:user>([^<]+)<\/cas:user>/);
        if (!userMatch) {
            console.error("[CAS] Validation failed. XML:", xml);
            return NextResponse.redirect(`${appUrl}/login?error=cas_invalid`);
        }

        const casUsername = userMatch[1].trim(); // e.g. "smohanty13" or "smohanty13@unl.edu"

        // Extract optional attributes
        const emailMatch = xml.match(/<cas:mail>([^<]+)<\/cas:mail>/) ||
            xml.match(/<cas:email>([^<]+)<\/cas:email>/);
        const displayNameMatch = xml.match(/<cas:displayName>([^<]+)<\/cas:displayName>/) ||
            xml.match(/<cas:cn>([^<]+)<\/cas:cn>/);
        const nuidMatch = xml.match(/<cas:UNL_NUID>([^<]+)<\/cas:UNL_NUID>/) ||
            xml.match(/<cas:employeeNumber>([^<]+)<\/cas:employeeNumber>/);

        const email = emailMatch ? emailMatch[1].trim() : `${casUsername}@huskers.unl.edu`;
        const displayName = displayNameMatch ? displayNameMatch[1].trim() : casUsername;
        const nuid = nuidMatch ? nuidMatch[1].trim() : null;

        // Upsert user — find by email or create new
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { nuid: nuid || undefined },
                ],
            },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    displayName,
                    nuid,
                    provider: "cas",
                    // No password — CAS-only user
                },
            });
            console.log(`[CAS] Created new user: ${email}`);
        } else {
            // Update display name and nuid if not set
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    displayName: user.displayName || displayName,
                    nuid: user.nuid || nuid,
                    provider: user.provider || "cas",
                },
            });
        }

        const token = signToken(user.id);

        // Redirect to dashboard with token as a query param
        // The frontend auth context will pick it up and store it
        return NextResponse.redirect(`${appUrl}/dashboard?token=${token}`);
    } catch (error) {
        console.error("[CAS] Callback error:", error);
        return NextResponse.redirect(`${appUrl}/login?error=cas_error`);
    }
}
