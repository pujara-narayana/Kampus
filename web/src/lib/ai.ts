import OpenAI from 'openai';

// Initialize OpenAI client once. Will be undefined if no key is provided.
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("[ai.ts] check OPENAI_API_KEY length:", apiKey ? apiKey.length : 0);
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

// ---------------------------------------------------------------------------
// 1. Event Relevance & Free Food Detection
// ---------------------------------------------------------------------------

const FOOD_KEYWORDS = [
  "free food", "free pizza", "free lunch", "free dinner", "free breakfast",
  "lunch provided", "dinner provided", "refreshments", "food will be served",
  "complimentary food", "free snacks", "pizza", "catering", "free meal",
  "food and drinks", "snacks provided", "free tacos", "free bbq",
  "come for the food", "treats", "donuts", "cookies provided"
];

// Fallback logic if OpenAI API is disabled
function fallbackDetectFreeFood(text: string) {
  const matches = FOOD_KEYWORDS.filter((kw) => text.toLowerCase().includes(kw));
  if (matches.length > 0) {
    return { hasFreeFood: true, foodDetails: matches.join(", ") };
  }
  return { hasFreeFood: false, foodDetails: null };
}

export async function detectFreeFood(
  title: string,
  description: string
): Promise<{ hasFreeFood: boolean; foodDetails: string | null }> {
  const client = getOpenAIClient();
  const rawText = `${title}\n${description}`;

  if (!client) {
    return fallbackDetectFreeFood(rawText);
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an assistant that analyzes university campus events. Look specifically for any mention of free food, meals, snacks, or refreshments being provided. Respond ONLY with a valid JSON object in the exact format: {\"hasFreeFood\": boolean, \"foodDetails\": \"string or null\"}. If food is provided, describe it briefly (e.g. \"Pizza and soda\")."
        },
        { role: "user", content: `Event title: ${title}\nDescription: ${description}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const output = JSON.parse(response.choices[0].message.content || '{}');
    return {
      hasFreeFood: output.hasFreeFood || false,
      foodDetails: output.foodDetails || null,
    };
  } catch (err: any) {
    console.error("OpenAI detecting free food failed:", err.message || err);
    return fallbackDetectFreeFood(rawText);
  }
}

// ---------------------------------------------------------------------------
// 2. Assignment Time Estimation
// ---------------------------------------------------------------------------

export async function estimateAssignmentTime(params: {
  name: string;
  courseName: string;
  description: string;
  pointsPossible: number;
  submissionTypes: string[];
  avgHoursSimilar?: number;
  currentScore?: number;
}): Promise<{ hours: number; reasoning: string }> {
  const client = getOpenAIClient();

  if (!client) {
    // Fallback heuristic when no API key
    let hours = 2;
    if (params.pointsPossible > 100) hours = 5;
    else if (params.pointsPossible > 50) hours = 3;
    if (params.submissionTypes.some((t) => ["online_upload", "external_tool"].includes(t))) hours += 1;
    if (params.description && params.description.length > 1000) hours += 1;
    return {
      hours,
      reasoning: `Estimated based on ${params.pointsPossible} points and submission type.`,
    };
  }

  try {
    const prompt = `You are an academic advisor analyzing a student's assignment.
Estimate the number of study hours a typical student should dedicate to complete this successfully. 
Consider difficulty, type, and length of description.

Assignment: ${params.name}
Course: ${params.courseName}
Description: ${(params.description || "").slice(0, 800)}
Points: ${params.pointsPossible}
Type: ${params.submissionTypes.join(", ")}
User's past average for this course: ${params.avgHoursSimilar || "unknown"}
User's current course grade: ${params.currentScore || "unknown"}%

Respond with ONLY a JSON object exactly matching this schema:
{"hours": <number>, "reasoning": "<A 1-sentence personalized strategic study tip for this assignment>"}
Avoid markdown formatting outside the JSON block.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return {
      hours: parsed.hours || 3,
      reasoning: parsed.reasoning || "Default estimate based on assignment type."
    };
  } catch (err) {
    console.error("OpenAI assignment estimation failed:", err);
    return { hours: 3, reasoning: "Default estimate" };
  }
}

// ---------------------------------------------------------------------------
// 3. Weekly Summary Generation
// ---------------------------------------------------------------------------

export async function generateWeeklySummary(data: {
  assignmentsDue: number;
  assignmentsCompleted: number;
  avgDaysBeforeDue: number;
  totalStudyHours: number;
  sessionsAttended: number;
  /** Events on campus this week (we don't track which ones the user attended) */
  eventsOnCampus?: number;
  /** Free food events on campus this week */
  freeFoodEventsOnCampus?: number;
  topCourse?: string;
  topCourseHours?: number;
}): Promise<string> {
  const client = getOpenAIClient();
  const events = data.eventsOnCampus ?? 0;
  const freeFood = data.freeFoodEventsOnCampus ?? 0;

  const fallback = `This week you completed ${data.assignmentsCompleted} of ${data.assignmentsDue} assignments. You started assignments an average of ${data.avgDaysBeforeDue.toFixed(1)} days before the deadline. You attended ${data.sessionsAttended} study sessions.${events > 0 ? ` There were ${events} events on campus this week${freeFood > 0 ? `, ${freeFood} with free food` : ""}.` : ""} Keep it up!`;

  if (!client) return fallback;

  try {
    const prompt = `Generate a brief, encouraging weekly summary for a college student based on these stats:
- Completed ${data.assignmentsCompleted} of ${data.assignmentsDue} assignments
- Started assignments avg ${data.avgDaysBeforeDue.toFixed(1)} days before deadline
- ${data.totalStudyHours} total study hours this week (from assignment work)
- Attended ${data.sessionsAttended} study sessions (they created or joined)
- On campus: ${events} events this week${freeFood > 0 ? ` (${freeFood} with free food)` : ""} — do NOT say "you attended" for events; we don't track event attendance
${data.topCourse ? `- Most time spent on: ${data.topCourse} (${data.topCourseHours}h)` : ""}

Keep it 2-3 sentences max, personalized, upbeat, and end with a single emoji.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || fallback;
  } catch (err) {
    console.error("OpenAI summary generation failed:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Utility: Geographic Distance (Independent of AI)
// ---------------------------------------------------------------------------

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
