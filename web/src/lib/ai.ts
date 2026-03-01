import { createHash } from "crypto";
import OpenAI from "openai";

// Initialize OpenAI client once. Will be undefined if no key is provided.
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

// ---------------------------------------------------------------------------
// Server-side caches to avoid repeated OpenAI calls for the same inputs
// ---------------------------------------------------------------------------

const ASSIGNMENT_ESTIMATE_CACHE_MAX = 1000;
const assignmentEstimateCache = new Map<
  string,
  { hours: number; reasoning: string }
>();

const WEEKLY_SUMMARY_CACHE_MAX = 200;
const WEEKLY_SUMMARY_TTL_MS = 5 * 60 * 1000; // 5 min
const weeklySummaryCache = new Map<
  string,
  { text: string; expiresAt: number }
>();

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Same key used for in-memory and DB cache. Export for sync route to check DB before calling API. */
export function getAssignmentEstimateCacheKey(params: {
  name: string;
  courseName: string;
  description: string;
  pointsPossible: number;
  submissionTypes: string[];
}): string {
  return hashKey(
    [
      params.name,
      params.courseName,
      (params.description || "").slice(0, 800),
      params.pointsPossible,
      params.submissionTypes.join(","),
    ].join("|")
  );
}

// ---------------------------------------------------------------------------
// 1. Event Relevance & Free Food Detection
// ---------------------------------------------------------------------------
// Note: UNL campus events (unl_campus_events_*.json) have a "perks" field that
// often explicitly lists "Free Food". events-data.ts uses perks + description
// for hasFreeFood, so we do NOT call OpenAI for those. detectFreeFood is for
// event sources that don't provide perks.

const FOOD_KEYWORDS = [
  "free food", "free pizza", "free lunch", "free dinner", "free breakfast",
  "lunch provided", "dinner provided", "refreshments", "food will be served",
  "complimentary food", "free snacks", "pizza", "catering", "free meal",
  "food and drinks", "snacks provided", "free tacos", "free bbq",
  "come for the food", "treats", "donuts", "cookies provided"
];

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

    const output = JSON.parse(response.choices[0].message.content || "{}");
    return {
      hasFreeFood: output.hasFreeFood || false,
      foodDetails: output.foodDetails || null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("OpenAI detecting free food failed:", msg);
    return fallbackDetectFreeFood(rawText);
  }
}

// ---------------------------------------------------------------------------
// 2. Assignment Time Estimation
// ---------------------------------------------------------------------------

function heuristicAssignmentEstimate(params: {
  pointsPossible: number;
  submissionTypes: string[];
  description?: string;
}): { hours: number; reasoning: string } {
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

export async function estimateAssignmentTime(params: {
  name: string;
  courseName: string;
  description: string;
  pointsPossible: number;
  submissionTypes: string[];
  avgHoursSimilar?: number;
  currentScore?: number;
}): Promise<{ hours: number; reasoning: string }> {
  const cacheKey = getAssignmentEstimateCacheKey(params);
  const cached = assignmentEstimateCache.get(cacheKey);
  if (cached) return cached;

  // Skip API for trivial assignments (no description, low points) — use heuristic only
  const desc = (params.description || "").trim();
  if (desc.length < 50 && params.pointsPossible <= 30) {
    const result = heuristicAssignmentEstimate(params);
    if (assignmentEstimateCache.size >= ASSIGNMENT_ESTIMATE_CACHE_MAX) {
      const firstKey = assignmentEstimateCache.keys().next().value;
      if (firstKey != null) assignmentEstimateCache.delete(firstKey);
    }
    assignmentEstimateCache.set(cacheKey, result);
    return result;
  }

  const client = getOpenAIClient();

  if (!client) {
    return heuristicAssignmentEstimate(params);
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

    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    const result = {
      hours: parsed.hours || 3,
      reasoning: parsed.reasoning || "Default estimate based on assignment type.",
    };
    // Cap cache size: evict oldest (first) entry
    if (assignmentEstimateCache.size >= ASSIGNMENT_ESTIMATE_CACHE_MAX) {
      const firstKey = assignmentEstimateCache.keys().next().value;
      if (firstKey != null) assignmentEstimateCache.delete(firstKey);
    }
    assignmentEstimateCache.set(cacheKey, result);
    return result;
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
  const events = data.eventsOnCampus ?? 0;
  const freeFood = data.freeFoodEventsOnCampus ?? 0;
  const fallback = `This week you completed ${data.assignmentsCompleted} of ${data.assignmentsDue} assignments. You started assignments an average of ${data.avgDaysBeforeDue.toFixed(1)} days before the deadline. You attended ${data.sessionsAttended} study sessions.${events > 0 ? ` There were ${events} events on campus this week${freeFood > 0 ? `, ${freeFood} with free food` : ""}.` : ""} Keep it up!`;

  // Skip API for empty weeks — use static message
  const hasActivity =
    (data.assignmentsDue ?? 0) > 0 ||
    (data.totalStudyHours ?? 0) > 0 ||
    (data.sessionsAttended ?? 0) > 0 ||
    (events > 0);
  if (!hasActivity) {
    return "No tracked activity this week yet. Add courses and sync assignments to get personalized insights! 📚";
  }

  // Cache by input hash to avoid duplicate OpenAI calls (e.g. concurrent requests same week)
  const cacheKey = hashKey(JSON.stringify(data));
  const now = Date.now();
  const cached = weeklySummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.text;

  const client = getOpenAIClient();
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

    const text = response.choices[0].message.content || fallback;
    // Evict expired and cap size
    if (weeklySummaryCache.size >= WEEKLY_SUMMARY_CACHE_MAX) {
      for (const [k, v] of weeklySummaryCache) {
        if (v.expiresAt <= now) weeklySummaryCache.delete(k);
      }
      while (weeklySummaryCache.size >= WEEKLY_SUMMARY_CACHE_MAX) {
        const firstKey = weeklySummaryCache.keys().next().value;
        if (firstKey != null) weeklySummaryCache.delete(firstKey);
      }
    }
    weeklySummaryCache.set(cacheKey, { text, expiresAt: now + WEEKLY_SUMMARY_TTL_MS });
    return text;
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
