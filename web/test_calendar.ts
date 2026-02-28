import { prisma } from "./src/lib/prisma";

async function run() {
  try {
    const start = new Date("2026-02-01");
    const end = new Date("2026-04-01");

    // Let's just grab ANY session first, then look at its participants
    const anySession = await prisma.studySession.findFirst({
      include: {
        participants: true
      }
    });

    if (!anySession) {
      console.log("CRITICAL: There are NO study sessions in the database for anyone!");
      return;
    }

    // Pick the user who created this session (or is a participant)
    const userId = anySession.creatorId || anySession.participants[0]?.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    console.log("Found a session! Using user:", user?.email, "id:", userId);

    // First: count total sessions user is part of
    const allUserSessions = await prisma.studySession.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId: userId } } },
        ]
      },
      include: {
        participants: {
          where: { userId: userId }
        }
      }
    });

    console.log(`\nFound ${allUserSessions.length} total sessions (upcoming, past, active) for user.`);

    // Second: The exact query from the calendar endpoint
    const studySessions = await prisma.studySession.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { participants: { some: { userId: userId, status: "accepted" } } },
        ],
        startTime: { gte: start, lte: end }
      },
      include: { participants: true }
    });

    console.log(`\nCalendar Study Sessions found (${start.toISOString()} to ${end.toISOString()}):`, studySessions.length);
    if (studySessions.length < allUserSessions.length) {
      console.log("WARNING: Calendar query found fewer sessions than the user has. Checking the mismatch...");
      const missingSessions = allUserSessions.filter(s => !studySessions.find(cs => cs.id === s.id));
      const first = missingSessions[0];
      console.log("Difference check for a missing session:");
      console.log(" - Session ID:", first.id);
      console.log(" - Full Title:", first.title);
      console.log(" - Has startTime:", !!first.startTime, "Value:", first.startTime?.toISOString());
      console.log(" - Is in date range?", first.startTime && first.startTime >= start && first.startTime <= end);
      console.log(" - is creator:", first.creatorId === userId);
      console.log(" - is participant accepted:", first.participants.some(p => p.status === 'accepted'));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
