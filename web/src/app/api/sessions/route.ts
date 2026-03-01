import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  createGoogleCalendarEvent,
  refreshGoogleTokensIfNeeded,
  type GoogleTokens,
} from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = (user.settings as { sessionVisibility?: string }) ?? {};
    const friendsOnly = settings.sessionVisibility === "friends";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let whereClause: any;

    if (friendsOnly) {
      const connections = await prisma.connection.findMany({
        where: {
          status: "accepted",
          OR: [{ requesterId: user.id }, { receiverId: user.id }],
        },
        select: { requesterId: true, receiverId: true },
      });
      const friendIds = connections.map((c) =>
        c.requesterId === user.id ? c.receiverId : c.requesterId
      );
      whereClause = {
        OR: [
          { creatorId: user.id },
          { participants: { some: { userId: user.id } } },
          ...(friendIds.length > 0 ? [{ creatorId: { in: friendIds } }] : []),
        ],
        status: { in: ["upcoming", "active"] },
      };
    } else {
      // Default: everyone's public sessions, plus your own and ones you joined
      whereClause = {
        OR: [
          { isPublic: true },
          { creatorId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
        status: { in: ["upcoming", "active"] },
      };
    }

    const sessions = await prisma.studySession.findMany({
      where: whereClause,
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        course: { select: { name: true, code: true } },
        groupChat: { select: { id: true } },
        participants: {
          where: { status: "accepted" },
          select: { id: true, userId: true }
        }
      },
      orderBy: { startTime: "asc" },
    });

    const mappedSessions = sessions.map(s => ({
      ...s,
      isCreator: s.creatorId === user.id,
      hasJoined: s.participants.some(p => p.userId === user.id),
      participantCount: s.participants.length,
    }));

    return NextResponse.json({ sessions: mappedSessions });
  } catch (error) {
    console.error("Sessions list error:", error);
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

    const body = await req.json();

    const session = await prisma.studySession.create({
      data: {
        creatorId: user.id,
        title: body.title || null,
        description: body.description || null,
        courseId: body.courseId || null,
        assignmentId: body.assignmentId || null,
        building: body.building || null,
        room: body.room || null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        startTime: body.startTime ? new Date(body.startTime) : null,
        endTime: body.endTime ? new Date(body.endTime) : null,
        maxParticipants: body.maxParticipants ?? 10,
        isPublic: body.isPublic ?? true,
      },
    });

    // Auto-add creator as a participant
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        status: "accepted",
        respondedAt: new Date(),
      },
    });

    // Create group chat for the session
    const groupChat = await prisma.groupChat.create({
      data: {
        sessionId: session.id,
        name: session.title || "Study Session Chat",
      },
    });
    await prisma.groupChatMember.create({
      data: {
        groupChatId: groupChat.id,
        userId: user.id,
        role: "admin",
      },
    });

    // Create a feed item
    await prisma.feedItem.create({
      data: {
        userId: user.id,
        type: "study_session_created",
        data: {
          sessionId: session.id,
          title: session.title,
          courseId: session.courseId,
        },
        visibility: session.isPublic ? "public" : "friends",
      },
    });

    let googleCalendarAdded = false;
    const tokens = user.googleToken as GoogleTokens | null;
    if (tokens?.access_token && session.startTime) {
      try {
        const freshTokens = await refreshGoogleTokensIfNeeded(tokens);
        await prisma.user.update({
          where: { id: user.id },
          data: { googleToken: freshTokens as object },
        });
        const created = await createGoogleCalendarEvent(freshTokens, {
          title: session.title || "Study Session",
          start: session.startTime,
          end: session.endTime ?? undefined,
          description: session.description ?? undefined,
          location: [session.building, session.room].filter(Boolean).join(", ") || undefined,
        });
        googleCalendarAdded = true;
        if (created?.id) {
          const settings = (user.settings as { studySessionGoogleEventIds?: string[] }) ?? {};
          const ids = [...(settings.studySessionGoogleEventIds ?? []), created.id];
          await prisma.user.update({
            where: { id: user.id },
            data: { settings: { ...settings, studySessionGoogleEventIds: ids } as object },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = err && typeof err === "object" && "code" in err ? (err as { code?: number }).code : undefined;
        console.error("Failed to add study session to Google Calendar:", message, code ?? "");
        // 403 = need to reconnect to grant calendar write permission
      }
    }

    return NextResponse.json({ session, googleCalendarAdded }, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
