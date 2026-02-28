import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const UNL_BUILDINGS = [
  { name: "Avery Hall", lat: 40.8194, lng: -96.7056 },
  { name: "Kauffman Academic Residential Center", shortName: "Kauffman", lat: 40.8187, lng: -96.7069 },
  { name: "Nebraska Union", lat: 40.8186, lng: -96.7003 },
  { name: "Love Library", lat: 40.8186, lng: -96.7022 },
  { name: "Hamilton Hall", lat: 40.8201, lng: -96.7041 },
  { name: "Burnett Hall", lat: 40.8185, lng: -96.7042 },
  { name: "Andrews Hall", lat: 40.8181, lng: -96.7022 },
  { name: "Henzlik Hall", lat: 40.821, lng: -96.7014 },
  { name: "East Campus Union", lat: 40.8316, lng: -96.6653 },
  { name: "Campus Recreation Center", shortName: "Rec Center", lat: 40.8204, lng: -96.6985 },
];

export async function POST() {
  try {
    const results = [];

    for (const building of UNL_BUILDINGS) {
      const upserted = await prisma.campusBuilding.upsert({
        where: { name: building.name },
        update: {
          lat: building.lat,
          lng: building.lng,
          shortName: building.shortName || null,
        },
        create: {
          name: building.name,
          shortName: building.shortName || null,
          lat: building.lat,
          lng: building.lng,
        },
      });
      results.push(upserted);
    }

    return NextResponse.json({
      seeded: results.length,
      buildings: results,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
