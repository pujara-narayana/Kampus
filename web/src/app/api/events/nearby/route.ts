import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { calculateWalkingDistance } from "@/lib/ai";
import { getEventsFromData } from "@/lib/events-data";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radiusMeters = parseInt(
      searchParams.get("radius_meters") || "800",
      10
    );

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng query parameters are required" },
        { status: 400 }
      );
    }

    const events = getEventsFromData({ limit: 300 });
    const withCoords = events.filter(
      (e) =>
        e.lat != null &&
        e.lng != null &&
        !Number.isNaN(e.lat) &&
        !Number.isNaN(e.lng)
    );

    const nearbyEvents = withCoords
      .map((event) => {
        const eventLat = Number(event.lat);
        const eventLng = Number(event.lng);
        const { distanceMeters, durationMinutes } = calculateWalkingDistance(
          lat,
          lng,
          eventLat,
          eventLng
        );
        return {
          ...event,
          distanceMeters,
          walkingMinutes: durationMinutes,
        };
      })
      .filter((e) => e.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return NextResponse.json({
      events: nearbyEvents,
      total: nearbyEvents.length,
      radiusMeters,
    });
  } catch (error) {
    console.error("Nearby events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
