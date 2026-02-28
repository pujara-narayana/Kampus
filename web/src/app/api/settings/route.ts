import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export interface UserSettings {
  sessionVisibility?: "all" | "friends";
}

/**
 * GET /api/settings — Return current user's settings.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const settings = (user.settings as UserSettings) ?? {};
    return NextResponse.json({
      sessionVisibility: settings.sessionVisibility ?? "all",
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings — Update user settings.
 * Body: { sessionVisibility?: "all" | "friends" }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const current = (user.settings as UserSettings) ?? {};
    const sessionVisibility = body.sessionVisibility as string | undefined;
    const nextSettings: UserSettings = {
      ...current,
      ...(sessionVisibility === "all" || sessionVisibility === "friends"
        ? { sessionVisibility }
        : {}),
    };
    await prisma.user.update({
      where: { id: user.id },
      data: { settings: nextSettings as object },
    });
    return NextResponse.json({
      sessionVisibility: nextSettings.sessionVisibility ?? "all",
    });
  } catch (error) {
    console.error("Settings PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
