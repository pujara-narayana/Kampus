const FOOD_KEYWORDS = [
  "free food",
  "free pizza",
  "free lunch",
  "free dinner",
  "free breakfast",
  "lunch provided",
  "dinner provided",
  "refreshments",
  "food will be served",
  "complimentary food",
  "free snacks",
  "pizza",
  "catering",
  "free meal",
  "food and drinks",
  "snacks provided",
  "free tacos",
  "free BBQ",
  "come for the food",
  "treats",
  "donuts",
  "cookies provided",
];

export function detectFreeFood(
  title: string,
  description: string
): { hasFreeFood: boolean; foodDetails: string | null } {
  const text = `${title} ${description}`.toLowerCase();
  const matches = FOOD_KEYWORDS.filter((kw) => text.includes(kw));

  if (matches.length > 0) {
    return {
      hasFreeFood: true,
      foodDetails: matches.join(", "),
    };
  }
  return { hasFreeFood: false, foodDetails: null };
}

export async function estimateAssignmentTime(params: {
  name: string;
  courseName: string;
  description: string;
  pointsPossible: number;
  submissionTypes: string[];
  avgHoursSimilar?: number;
  currentScore?: number;
}): Promise<{ hours: number; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback heuristic when no API key
    let hours = 2;
    if (params.pointsPossible > 100) hours = 5;
    else if (params.pointsPossible > 50) hours = 3;
    if (
      params.submissionTypes.some((t) =>
        ["online_upload", "external_tool"].includes(t)
      )
    )
      hours += 1;
    if (params.description && params.description.length > 1000) hours += 1;
    return {
      hours,
      reasoning: `Estimated based on ${params.pointsPossible} points and submission type`,
    };
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are an academic advisor. Given the following assignment, estimate how many hours a typical student should spend on it. Consider difficulty, scope, and the student's past performance.

Assignment: ${params.name}
Course: ${params.courseName}
Description: ${(params.description || "").slice(0, 500)}
Points: ${params.pointsPossible}
Type: ${params.submissionTypes.join(", ")}
User's past average for this course: ${params.avgHoursSimilar || "unknown"}
User's current grade: ${params.currentScore || "unknown"}%

Respond with ONLY a JSON object: {"hours": <number>, "reasoning": "<1 sentence>"}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text);
  } catch {
    return { hours: 3, reasoning: "Default estimate" };
  }
}

export async function generateWeeklySummary(data: {
  assignmentsDue: number;
  assignmentsCompleted: number;
  avgDaysBeforeDue: number;
  totalStudyHours: number;
  sessionsAttended: number;
  eventsAttended: number;
  freeFoodEvents: number;
  topCourse?: string;
  topCourseHours?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const fallback = `This week you completed ${data.assignmentsCompleted} of ${data.assignmentsDue} assignments. You started assignments an average of ${data.avgDaysBeforeDue.toFixed(1)} days before the deadline. You attended ${data.eventsAttended} events${data.freeFoodEvents > 0 ? `, ${data.freeFoodEvents} of which had free food` : ""}. Keep it up!`;

  if (!apiKey) return fallback;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Generate a brief, encouraging weekly summary for a college student. Use these stats:
- Completed ${data.assignmentsCompleted} of ${data.assignmentsDue} assignments
- Started assignments avg ${data.avgDaysBeforeDue.toFixed(1)} days before deadline
- ${data.totalStudyHours} total study hours
- Attended ${data.sessionsAttended} study sessions
- Attended ${data.eventsAttended} events (${data.freeFoodEvents} had free food)
${data.topCourse ? `- Most time on: ${data.topCourse} (${data.topCourseHours}h)` : ""}

Keep it 2-3 sentences, friendly, with one emoji at the end.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

export function calculateWalkingDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceMeters: number; durationMinutes: number } {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  // Walking speed: 5 km/h = 83.3 m/min
  const duration = distance / 83.3;
  return {
    distanceMeters: Math.round(distance),
    durationMinutes: Math.round(duration * 10) / 10,
  };
}
