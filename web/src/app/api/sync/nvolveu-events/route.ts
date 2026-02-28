import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { detectFreeFood } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { events } = await req.json();

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: "events must be an array" },
        { status: 400 }
      );
    }

    const results = [];

    for (const e of events) {
      const foodResult = detectFreeFood(e.title || "", e.description || "");

      const event = await prisma.event.upsert({
        where: {
          source_sourceId: {
            source: "nvolveu",
            sourceId: String(e.sourceId),
          },
        },
        update: {
          title: e.title || null,
          description: e.description || null,
          startTime: e.startTime ? new Date(e.startTime) : null,
          endTime: e.endTime ? new Date(e.endTime) : null,
          building: e.building || null,
          room: e.room || null,
          address: e.address || null,
          lat: e.lat ?? null,
          lng: e.lng ?? null,
          hasFreeFood: foodResult.hasFreeFood,
          foodDetails: foodResult.foodDetails,
          eventType: e.eventType || null,
          orgName: e.orgName || null,
          eventUrl: e.eventUrl || null,
          scrapedAt: new Date(),
        },
        create: {
          source: "nvolveu",
          sourceId: String(e.sourceId),
          title: e.title || null,
          description: e.description || null,
          startTime: e.startTime ? new Date(e.startTime) : null,
          endTime: e.endTime ? new Date(e.endTime) : null,
          building: e.building || null,
          room: e.room || null,
          address: e.address || null,
          lat: e.lat ?? null,
          lng: e.lng ?? null,
          hasFreeFood: foodResult.hasFreeFood,
          foodDetails: foodResult.foodDetails,
          eventType: e.eventType || null,
          orgName: e.orgName || null,
          eventUrl: e.eventUrl || null,
        },
      });

      results.push(event.id);
    }

    return NextResponse.json({
      synced: results.length,
      eventIds: results,
    });
  } catch (error) {
    console.error("Sync NvolveU events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
