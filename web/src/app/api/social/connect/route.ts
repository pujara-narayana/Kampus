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
    const status = searchParams.get("status") || undefined;

    const connections = await prisma.connection.findMany({
      where: {
        OR: [{ requesterId: user.id }, { receiverId: user.id }],
        ...(status ? { status } : {}),
      },
      include: {
        requester: {
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        },
        receiver: {
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("List connections error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { receiverId } = await req.json();

    if (!receiverId) {
      return NextResponse.json(
        { error: "receiverId is required" },
        { status: 400 }
      );
    }

    if (receiverId === user.id) {
      return NextResponse.json(
        { error: "Cannot connect with yourself" },
        { status: 400 }
      );
    }

    // Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check for existing connection in either direction
    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: user.id, receiverId },
          { requesterId: receiverId, receiverId: user.id },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Connection already exists", connection: existing },
        { status: 409 }
      );
    }

    const connection = await prisma.connection.create({
      data: {
        requesterId: user.id,
        receiverId,
      },
    });

    // Notify the receiver
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: "friend_request",
        title: "New friend request",
        body: `${user.displayName || "Someone"} sent you a friend request`,
        data: { connectionId: connection.id, requesterId: user.id },
      },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error("Send connection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
