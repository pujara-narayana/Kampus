import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const session = await prisma.studySession.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        course: { select: { name: true, code: true } },
        assignment: { select: { name: true, dueAt: true } },
        participants: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Attach groupChat.id if the GroupChat model exists (optional: client may be from older schema)
    const prismaWithGroupChat = prisma as typeof prisma & {
      groupChat?: { findUnique: (args: { where: { sessionId: string } }) => Promise<{ id: string } | null> };
    };
    let groupChat: { id: string } | null = null;
    if (prismaWithGroupChat.groupChat) {
      groupChat = await prismaWithGroupChat.groupChat.findUnique({
        where: { sessionId: id },
      });
    }

    const sessionWithGroupChat = {
      ...session,
      groupChat: groupChat ? { id: groupChat.id } : null,
    };

    return NextResponse.json({ session: sessionWithGroupChat });
  } catch (error) {
    console.error("Session detail error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
