import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const UNL_BUILDINGS = [
  { name: "Avery Hall", shortName: "AVRY", lat: 40.8194, lng: -96.7056 },
  { name: "Kauffman Academic Residential Center", shortName: "Kauffman", lat: 40.8187, lng: -96.7069 },
  { name: "Nebraska Union", shortName: "NU", lat: 40.8186, lng: -96.7003 },
  { name: "Love Library", shortName: "LOVE", lat: 40.8186, lng: -96.7022 },
  { name: "Hamilton Hall", shortName: "HAM", lat: 40.8201, lng: -96.7041 },
  { name: "Burnett Hall", shortName: "BRNT", lat: 40.8185, lng: -96.7042 },
  { name: "Andrews Hall", shortName: "ANDR", lat: 40.8181, lng: -96.7022 },
  { name: "Henzlik Hall", shortName: "HENZ", lat: 40.821, lng: -96.7014 },
  { name: "East Campus Union", shortName: "ECU", lat: 40.8316, lng: -96.6653 },
  { name: "Campus Recreation Center", shortName: "Rec Center", lat: 40.8204, lng: -96.6985 },
];

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function hoursFromNow(hours: number) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    // 1. Seed campus buildings
    const buildings = [];
    for (const b of UNL_BUILDINGS) {
      const upserted = await prisma.campusBuilding.upsert({
        where: { name: b.name },
        update: { lat: b.lat, lng: b.lng, shortName: b.shortName },
        create: { name: b.name, shortName: b.shortName, lat: b.lat, lng: b.lng },
      });
      buildings.push(upserted);
    }

    // 2. Seed courses
    const courseData = [
      { canvasId: BigInt(10001), name: "Software Engineering", code: "CSCE 361", term: "Spring 2026", currentGrade: "A-", currentScore: 92.5 },
      { canvasId: BigInt(10002), name: "Data Structures", code: "CSCE 310", term: "Spring 2026", currentGrade: "B+", currentScore: 87.3 },
      { canvasId: BigInt(10003), name: "Calculus III", code: "MATH 208", term: "Spring 2026", currentGrade: "A", currentScore: 95.1 },
      { canvasId: BigInt(10004), name: "Technical Writing", code: "ENGL 150", term: "Spring 2026", currentGrade: "B", currentScore: 84.0 },
      { canvasId: BigInt(10005), name: "Intro to AI", code: "CSCE 476", term: "Spring 2026", currentGrade: "A-", currentScore: 91.0 },
    ];

    const courses = [];
    for (const c of courseData) {
      const course = await prisma.course.upsert({
        where: { canvasId_userId: { canvasId: c.canvasId, userId: user.id } },
        update: { name: c.name, code: c.code, term: c.term, currentGrade: c.currentGrade, currentScore: c.currentScore },
        create: { ...c, userId: user.id },
      });
      courses.push(course);
    }

    // 3. Seed assignments
    const assignmentData = [
      { canvasId: BigInt(20001), courseIdx: 0, name: "Lab 5: REST API Design", dueAt: daysFromNow(2), pointsPossible: 100, submissionTypes: ["online_upload"], hasSubmitted: false, estimatedHours: 3.0 },
      { canvasId: BigInt(20002), courseIdx: 0, name: "Midterm Project: Team Sprint", dueAt: daysFromNow(7), pointsPossible: 200, submissionTypes: ["online_upload", "online_text_entry"], hasSubmitted: false, estimatedHours: 12.0 },
      { canvasId: BigInt(20003), courseIdx: 1, name: "Assignment 6: Graph Algorithms", dueAt: daysFromNow(3), pointsPossible: 50, submissionTypes: ["online_upload"], hasSubmitted: false, estimatedHours: 4.0 },
      { canvasId: BigInt(20004), courseIdx: 1, name: "Quiz 4: Trees & Heaps", dueAt: daysFromNow(1), pointsPossible: 25, submissionTypes: ["online_quiz"], hasSubmitted: false, estimatedHours: 1.5 },
      { canvasId: BigInt(20005), courseIdx: 2, name: "Homework 8: Triple Integrals", dueAt: daysFromNow(4), pointsPossible: 30, submissionTypes: ["online_upload"], hasSubmitted: false, estimatedHours: 2.5 },
      { canvasId: BigInt(20006), courseIdx: 3, name: "Essay Draft: Technical Report", dueAt: daysFromNow(5), pointsPossible: 100, submissionTypes: ["online_text_entry"], hasSubmitted: false, estimatedHours: 5.0 },
      { canvasId: BigInt(20007), courseIdx: 4, name: "Lab 3: Neural Network", dueAt: daysFromNow(6), pointsPossible: 75, submissionTypes: ["online_upload"], hasSubmitted: false, estimatedHours: 6.0 },
      { canvasId: BigInt(20008), courseIdx: 0, name: "Lab 4: Unit Testing", dueAt: daysFromNow(-1), pointsPossible: 100, submissionTypes: ["online_upload"], hasSubmitted: true, score: 92, estimatedHours: 2.0 },
      { canvasId: BigInt(20009), courseIdx: 2, name: "Homework 7: Surface Integrals", dueAt: daysFromNow(-3), pointsPossible: 30, submissionTypes: ["online_upload"], hasSubmitted: true, score: 28, estimatedHours: 2.0 },
    ];

    const assignments = [];
    for (const a of assignmentData) {
      const assignment = await prisma.assignment.upsert({
        where: { canvasId_userId: { canvasId: a.canvasId, userId: user.id } },
        update: { name: a.name, dueAt: a.dueAt, pointsPossible: a.pointsPossible, hasSubmitted: a.hasSubmitted, score: a.score ?? null, estimatedHours: a.estimatedHours },
        create: {
          canvasId: a.canvasId,
          courseId: courses[a.courseIdx].id,
          userId: user.id,
          name: a.name,
          dueAt: a.dueAt,
          pointsPossible: a.pointsPossible,
          submissionTypes: a.submissionTypes,
          hasSubmitted: a.hasSubmitted,
          score: a.score ?? null,
          estimatedHours: a.estimatedHours,
        },
      });
      assignments.push(assignment);
    }

    // 4. Seed events (including free food!)
    const eventData = [
      { source: "nvolveu", sourceId: "ev-001", title: "Women in STEM Mixer", description: "Network with women in STEM fields. Free pizza provided!", startTime: hoursFromNow(3), building: "Kauffman Academic Residential Center", hasFreeFood: true, foodDetails: "Free pizza", eventType: "social", orgName: "Women in Computing" },
      { source: "nvolveu", sourceId: "ev-002", title: "ACM Programming Contest Prep", description: "Weekly competitive programming practice session", startTime: daysFromNow(1), building: "Avery Hall", room: "115", hasFreeFood: false, eventType: "academic", orgName: "ACM UNL" },
      { source: "unl_events", sourceId: "ev-003", title: "Career Fair: Tech Companies", description: "Meet recruiters from 12+ CS companies. Lunch provided for attendees.", startTime: daysFromNow(2), endTime: daysFromNow(2), building: "Nebraska Union", hasFreeFood: true, foodDetails: "Lunch provided", eventType: "career", orgName: "UNL Career Services" },
      { source: "nvolveu", sourceId: "ev-004", title: "Hack Night", description: "Open hack session for all skill levels. Bring your projects! Snacks and energy drinks provided.", startTime: daysFromNow(3), building: "Kauffman Academic Residential Center", hasFreeFood: true, foodDetails: "Snacks & energy drinks", eventType: "academic", orgName: "Raikes School" },
      { source: "unl_events", sourceId: "ev-005", title: "Basketball: Huskers vs Iowa", description: "Big Ten conference game", startTime: daysFromNow(4), building: "Pinnacle Bank Arena", hasFreeFood: false, eventType: "sports", orgName: "UNL Athletics" },
      { source: "nvolveu", sourceId: "ev-006", title: "Study Abroad Info Session", description: "Learn about CS study abroad programs. Free donuts!", startTime: hoursFromNow(26), building: "Love Library", room: "North 110", hasFreeFood: true, foodDetails: "Free donuts", eventType: "academic", orgName: "Global Experiences" },
      { source: "unl_events", sourceId: "ev-007", title: "Open Mic Night", description: "Student performances at the union. Free tacos!", startTime: daysFromNow(2), building: "Nebraska Union", hasFreeFood: true, foodDetails: "Free tacos", eventType: "social", orgName: "Student Activities" },
      { source: "nvolveu", sourceId: "ev-008", title: "Research Symposium", description: "Undergraduate research presentations", startTime: daysFromNow(5), building: "Hamilton Hall", hasFreeFood: false, eventType: "academic", orgName: "UNL Research" },
    ];

    for (const e of eventData) {
      await prisma.event.upsert({
        where: { source_sourceId: { source: e.source, sourceId: e.sourceId } },
        update: { title: e.title, description: e.description, startTime: e.startTime, building: e.building, room: e.room || null, hasFreeFood: e.hasFreeFood, foodDetails: e.foodDetails || null, eventType: e.eventType, orgName: e.orgName },
        create: { ...e, room: e.room || null, foodDetails: e.foodDetails || null, endTime: e.endTime || null },
      });
    }

    // 5. Seed class schedule
    const scheduleData = [
      { courseCode: "CSCE 361", courseTitle: "Software Engineering", days: "MWF", startTime: "14:00", endTime: "14:50", building: "Avery Hall", room: "115", instructor: "Dr. Smith", term: "Spring 2026" },
      { courseCode: "CSCE 310", courseTitle: "Data Structures", days: "TR", startTime: "09:30", endTime: "10:45", building: "Avery Hall", room: "21", instructor: "Dr. Chen", term: "Spring 2026" },
      { courseCode: "MATH 208", courseTitle: "Calculus III", days: "MWF", startTime: "10:00", endTime: "10:50", building: "Hamilton Hall", room: "104", instructor: "Dr. Williams", term: "Spring 2026" },
      { courseCode: "ENGL 150", courseTitle: "Technical Writing", days: "TR", startTime: "13:00", endTime: "14:15", building: "Andrews Hall", room: "212", instructor: "Prof. Davis", term: "Spring 2026" },
      { courseCode: "CSCE 476", courseTitle: "Intro to AI", days: "MWF", startTime: "11:00", endTime: "11:50", building: "Avery Hall", room: "110", instructor: "Dr. Patel", term: "Spring 2026" },
    ];

    // Clear old schedule for user, then re-seed
    await prisma.classSchedule.deleteMany({ where: { userId: user.id } });
    for (const s of scheduleData) {
      await prisma.classSchedule.create({ data: { ...s, userId: user.id } });
    }

    // 6. Seed study sessions
    const session1 = await prisma.studySession.create({
      data: {
        creatorId: user.id,
        title: "CSCE 361 Midterm Prep",
        description: "Let's review chapters 5-8 together. Focus on design patterns and testing strategies.",
        courseId: courses[0].id,
        building: "Love Library",
        room: "2nd Floor",
        startTime: daysFromNow(1),
        endTime: daysFromNow(1),
        maxParticipants: 8,
        status: "upcoming",
      },
    });

    const session2 = await prisma.studySession.create({
      data: {
        creatorId: user.id,
        title: "MATH 208 Triple Integrals Study Group",
        description: "Working through homework 8 problems together.",
        courseId: courses[2].id,
        building: "Hamilton Hall",
        room: "Lobby",
        startTime: daysFromNow(2),
        endTime: daysFromNow(2),
        maxParticipants: 6,
        status: "upcoming",
      },
    });

    await prisma.studySession.create({
      data: {
        creatorId: user.id,
        title: "AI Lab 3 Collab",
        description: "Work on neural network lab together. Let's debug our models!",
        courseId: courses[4].id,
        building: "Avery Hall",
        room: "110",
        startTime: daysFromNow(3),
        maxParticipants: 5,
        status: "upcoming",
      },
    });

    // Add user as participant to their own sessions
    await prisma.sessionParticipant.create({
      data: { sessionId: session1.id, userId: user.id, status: "accepted" },
    });
    await prisma.sessionParticipant.create({
      data: { sessionId: session2.id, userId: user.id, status: "accepted" },
    });

    // 7. Seed notifications
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: "assignment_due_soon", title: "CSCE 310 Quiz 4 due tomorrow!", body: "Quiz 4: Trees & Heaps is due in 24 hours. Estimated time: 1.5h." },
        { userId: user.id, type: "free_food_nearby", title: "🍕 Free pizza at Kauffman!", body: "Women in STEM Mixer has free pizza — 3 min walk from Avery Hall." },
        { userId: user.id, type: "session_invite", title: "New study session for CSCE 361", body: "Someone created a study session for your course." },
        { userId: user.id, type: "event_recommendation", title: "Career Fair tomorrow!", body: "Tech Career Fair at Nebraska Union — 12 CS companies attending." },
        { userId: user.id, type: "assignment_due_soon", title: "Lab 5 due in 2 days", body: "CSCE 361 Lab 5: REST API Design. Estimated: 3h." },
        { userId: user.id, type: "free_food_nearby", title: "🍩 Free donuts at Love Library", body: "Study Abroad Info Session has free donuts tomorrow." },
      ],
    });

    // 8. Seed streaks
    await prisma.streak.deleteMany({ where: { userId: user.id } });
    await prisma.streak.createMany({
      data: [
        { userId: user.id, type: "daily_study", currentCount: 7, longestCount: 14, lastActivity: new Date(), startedAt: daysFromNow(-7) },
        { userId: user.id, type: "on_time_submission", currentCount: 4, longestCount: 9, lastActivity: new Date(), startedAt: daysFromNow(-4) },
        { userId: user.id, type: "social_study", currentCount: 3, longestCount: 5, lastActivity: new Date(), startedAt: daysFromNow(-3) },
      ],
    });

    // 9. Seed feed items
    await prisma.feedItem.createMany({
      data: [
        { userId: user.id, type: "session_created", data: { title: "CSCE 361 Midterm Prep" }, visibility: "public" },
        { userId: user.id, type: "assignment_completed", data: { courseName: "CSCE 361", assignmentName: "Lab 4: Unit Testing" }, visibility: "friends" },
        { userId: user.id, type: "streak_achieved", data: { type: "daily_study", count: 7 }, visibility: "public" },
        { userId: user.id, type: "free_food_spotted", data: { location: "Kauffman Hall", food: "Pizza" }, visibility: "public" },
      ],
    });

    // 10. Seed assignment behaviors
    await prisma.assignmentBehavior.deleteMany({ where: { userId: user.id } });
    await prisma.assignmentBehavior.createMany({
      data: [
        { userId: user.id, assignmentId: assignments[7].id, dueAt: assignments[7].dueAt, submittedAt: daysFromNow(-2), daysBeforeDue: 1.0, estimatedHours: 2.0, actualHours: 2.5, procrastinationScore: 0.3 },
        { userId: user.id, assignmentId: assignments[8].id, dueAt: assignments[8].dueAt, submittedAt: daysFromNow(-4), daysBeforeDue: 2.0, estimatedHours: 2.0, actualHours: 1.5, procrastinationScore: 0.2 },
      ],
    });

    // 11. Seed weekly summary
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
    weekStart.setHours(0, 0, 0, 0);
    await prisma.weeklySummary.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      update: {},
      create: {
        userId: user.id,
        weekStart,
        totalAssignmentsDue: 7,
        assignmentsCompleted: 2,
        avgDaysBeforeDue: 1.8,
        totalStudyHours: 18.5,
        studySessionsAttended: 3,
        eventsAttended: 2,
        freeFoodEvents: 2,
        campusBuildingsVisited: 5,
        aiSummary: "This week you completed 2 of 7 assignments on time. You spent the most time on CSCE 361 (8.5 hours) and the least on ENGL 150 (1.2 hours). You started assignments an average of 1.8 days before the deadline. You attended 2 events, both of which had free food. You're on a 7-day study streak — keep it up! 🔥",
      },
    });

    // 12. Seed user course links
    for (const course of courses) {
      await prisma.userCourseLink.upsert({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        update: {},
        create: { userId: user.id, courseId: course.id, canvasCourseId: course.canvasId },
      });
    }

    return NextResponse.json({
      message: "Demo data seeded successfully!",
      seeded: {
        buildings: buildings.length,
        courses: courses.length,
        assignments: assignments.length,
        events: eventData.length,
        schedule: scheduleData.length,
        sessions: 3,
        notifications: 6,
        streaks: 3,
        feedItems: 4,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
