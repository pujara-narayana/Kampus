import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/sync/nvolveu
 * Server-side NvolveU/Presence event sync.
 * Fetches events from UNL's public feeds — no auth needed.
 */
export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const feedUrls = [
            "https://events.unl.edu/upcoming/?format=json",
            "https://involved.unl.edu/api/discovery/event/search?take=100&orderByField=endsOn&orderByDirection=ascending",
        ];

        let events: any[] = [];

        for (const url of feedUrls) {
            try {
                const res = await fetch(url, {
                    headers: { Accept: "application/json" },
                    signal: AbortSignal.timeout(8000),
                });
                if (res.ok) {
                    const data = await res.json();
                    const items = Array.isArray(data) ? data : data.events || data.value || data.items || [];
                    if (items.length > 0) {
                        events = items;
                        break;
                    }
                }
            } catch {
                // Try next URL
            }
        }

        let upserted = 0;

        for (const e of events) {
            const sourceId = String(e.id || e.eventId || e.Id || "");
            const title = e.title || e.name || e.Name || e.eventName || "";
            if (!sourceId || !title) continue;

            const description = e.description || e.Description || e.subtitle || "";
            const startTime = e.startsOn || e.startTime || e.start_time || e.startDate || null;
            const endTime = e.endsOn || e.endTime || e.end_time || e.endDate || null;
            const location = e.location || e.locationName || e.Location || e.venue || "";
            const orgName = e.organizationName || e.org_name || e.orgName || "";
            const eventUrl = e.url || e.eventUrl || e.Uri || "";

            // Free food detection
            const text = `${title} ${description}`.toLowerCase();
            const hasFreeFood =
                text.includes("free food") ||
                text.includes("free pizza") ||
                text.includes("free lunch") ||
                text.includes("free dinner") ||
                text.includes("free breakfast") ||
                text.includes("complimentary") ||
                (text.includes("free") && (text.includes("snack") || text.includes("meal") || text.includes("refreshment")));

            try {
                await prisma.event.upsert({
                    where: {
                        source_sourceId: {
                            source: "nvolveu",
                            sourceId,
                        },
                    },
                    update: {
                        title,
                        description: typeof description === "string" ? description.substring(0, 2000) : "",
                        startTime: startTime ? new Date(startTime) : null,
                        endTime: endTime ? new Date(endTime) : null,
                        building: typeof location === "string" ? location : (location?.name || ""),
                        orgName,
                        eventUrl,
                        hasFreeFood,
                    },
                    create: {
                        source: "nvolveu",
                        sourceId,
                        title,
                        description: typeof description === "string" ? description.substring(0, 2000) : "",
                        startTime: startTime ? new Date(startTime) : null,
                        endTime: endTime ? new Date(endTime) : null,
                        building: typeof location === "string" ? location : (location?.name || ""),
                        orgName,
                        eventUrl,
                        hasFreeFood,
                    },
                });
                upserted++;
            } catch (err) {
                console.warn("[NvolveU Sync] Skipping event:", sourceId, err);
            }
        }

        return NextResponse.json({
            success: true,
            synced: { events: upserted, total: events.length },
        });
    } catch (error) {
        console.error("[NvolveU Sync] Error:", error);
        return NextResponse.json(
            { error: "NvolveU sync failed" },
            { status: 500 }
        );
    }
}
