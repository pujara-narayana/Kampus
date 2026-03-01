import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, getAuthUser } from "@/lib/auth";

/**
 * POST /api/auth/extension-register
 * Called by the Chrome extension to auto-register/login a user
 * using data scraped from MyRed (name, NUID, email).
 * If the user already exists, it logs them in.
 */
export async function POST(req: NextRequest) {
    try {
        const { displayName, nuid, email } = await req.json();

        // 1. If extension is already authenticated, use that user
        let user = await getAuthUser(req);

        // 2. Otherwise try to find existing user by NUID or email
        if (!user) {
            if (nuid) {
                user = await prisma.user.findFirst({ where: { nuid } });
            }
            if (!user && email) {
                user = await prisma.user.findFirst({ where: { email } });
            }

            // 3. Auto-create new user ONLY IF we have an identifier. 
            // We do NOT want ghost "UNL Student" users floating around!
            if (!user) {
                if (!nuid && !email) {
                    return NextResponse.json(
                        { error: "Cannot auto-register without an NUID or email" },
                        { status: 400 }
                    );
                }

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
            }
        }

        // Update info if missing (or replace placeholder names)
        const updatedName = (!user.displayName || user.displayName === "UNL Student") && displayName && displayName !== "UNL Student"
            ? displayName
            : user.displayName;

        await prisma.user.update({
            where: { id: user.id },
            data: {
                displayName: updatedName || "UNL Student",
                nuid: user.nuid || nuid || null,
                provider: user.provider || "myred",
            },
        });

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
