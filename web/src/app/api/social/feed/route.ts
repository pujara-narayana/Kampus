import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get friend IDs (accepted connections)
    const connections = await prisma.connection.findMany({
      where: {
        status: "accepted",
        OR: [{ requesterId: user.id }, { receiverId: user.id }],
      },
    });

    const friendIds = connections.map((c) =>
      c.requesterId === user.id ? c.receiverId : c.requesterId
    );

    // Fetch feed items: own + friends' (friends visibility) + public
    const feedItems = await prisma.feedItem.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userId: { in: friendIds }, visibility: { in: ["friends", "public"] } },
          { visibility: "public" },
        ],
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({ feedItems });
  } catch (error) {
    console.error("Social feed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
