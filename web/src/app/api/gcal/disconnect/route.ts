import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";

/**
 * POST /api/gcal/disconnect
 * Clears the user's Google Calendar connection (googleToken).
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { googleToken: Prisma.DbNull },
  });

  return NextResponse.json({ ok: true });
}
