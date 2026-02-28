import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

/**
 * POST /api/auth/extension-register
 * Called by the Chrome extension to auto-register/login a user
 * using data scraped from MyRed (name, NUID, email).
 * If the user already exists, it logs them in.
 */
export async function POST(req: NextRequest) {
    try {
        const { displayName, nuid, email } = await req.json();

        if (!displayName && !nuid && !email) {
            return NextResponse.json(
                { error: "At least one identifier (name, NUID, or email) is required" },
                { status: 400 }
            );
        }

        // Try to find existing user by NUID or email
        let user = null;

        if (nuid) {
            user = await prisma.user.findFirst({ where: { nuid } });
        }
        if (!user && email) {
            user = await prisma.user.findFirst({ where: { email } });
        }

        if (!user) {
            // Auto-create new user
            const userEmail = email || (nuid ? `${nuid}@huskers.unl.edu` : null);
            user = await prisma.user.create({
                data: {
                    displayName: displayName || "UNL Student",
                    nuid: nuid || null,
                    email: userEmail,
                    provider: "myred",
                },
            });
            console.log(`[Extension Register] Created user: ${userEmail || nuid}`);
        } else {
            // Update info if missing
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    displayName: user.displayName || displayName,
                    nuid: user.nuid || nuid,
                    provider: user.provider || "myred",
                },
            });
        }

        const token = signToken(user.id);

        return NextResponse.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName || displayName,
                nuid: user.nuid || nuid,
                avatarUrl: user.avatarUrl,
            },
        });
    } catch (error) {
        console.error("[Extension Register] Error:", error);
        return NextResponse.json(
            { error: "Registration failed" },
            { status: 500 }
        );
    }
}
