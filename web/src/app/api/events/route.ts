import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getEventsFromData, getEventsCount } from "@/lib/events-data";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const freeFood = searchParams.get("free_food") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 300);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const events = getEventsFromData({ freeFoodOnly: freeFood, limit, offset });
    const total = getEventsCount({ freeFoodOnly: freeFood });

    return NextResponse.json({ events, total, limit, offset });
  } catch (error) {
    console.error("Events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
