import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PUT /api/social/connect/:id
 * Accept or decline a friend request.
 * Body: { action: "accept" | "decline" }
 * Only the receiver can accept/decline.
 */
export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: connectionId } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID is required" },
        { status: 400 }
      );
    }
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { error: "action must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        requester: { select: { id: true, displayName: true } },
        receiver: { select: { id: true, displayName: true } },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Only the receiver can accept or decline
    if (connection.receiverId !== user.id) {
      return NextResponse.json(
        { error: "Only the receiver can accept or decline this request" },
        { status: 403 }
      );
    }

    if (connection.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been responded to" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      await prisma.connection.update({
        where: { id: connectionId },
        data: { status: "accepted" },
      });
      return NextResponse.json({
        connection: { ...connection, status: "accepted" as const },
        message: "Friend request accepted",
      });
    }

    // decline: remove the connection
    await prisma.connection.delete({
      where: { id: connectionId },
    });
    return NextResponse.json({
      message: "Friend request declined",
    });
  } catch (error) {
    console.error("Accept/decline connection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
