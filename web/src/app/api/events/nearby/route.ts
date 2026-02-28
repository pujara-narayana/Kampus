import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { calculateWalkingDistance } from "@/lib/ai";

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

    // Fetch upcoming events that have coordinates
    const events = await prisma.event.findMany({
      where: {
        startTime: { gte: new Date() },
        lat: { not: null },
        lng: { not: null },
      },
      orderBy: { startTime: "asc" },
    });

    // Calculate distance for each event and filter by radius
    const nearbyEvents = events
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
      .filter((event) => event.distanceMeters <= radiusMeters)
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
