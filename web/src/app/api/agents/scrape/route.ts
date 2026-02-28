import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { multiAgentScraper } from "@/lib/agents/supervisor";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { goal, nuid, password } = body;

        if (!goal) {
            return NextResponse.json({ error: "Missing goal string" }, { status: 400 });
        }

        // Embed NUID and Password invisibly into the goal so the agents have access to type them into TrueYou
        const enrichedGoal = `${goal}\nNUID:${nuid || ""}\nPASS:${password || ""}`;

        console.log(`[LangGraph API] User ${user.id} requested scraping task: "${goal}"`);

        // -------------------------------------------------------------------------
        // Execute the LangGraph Workflow
        // -------------------------------------------------------------------------

        // The state machine starts here
        const initialState = {
            goal: enrichedGoal,
            messages: [],
            platform: null,
            currentUrl: null,
            htmlContent: null,
            extractedData: null,
            status: "idle",
            errorMessage: null,
        };

        // Run the compiled graph (invoke blocks until the StateGraph reaches the End node)
        const finalState = await multiAgentScraper.invoke(initialState, {
            recursionLimit: 5,
        });

        if (finalState.status === "error") {
            return NextResponse.json({
                success: false,
                error: finalState.errorMessage
            }, { status: 500 });
        }

        // -------------------------------------------------------------------------
        // Prisma Operations based on Extracted Data
        // -------------------------------------------------------------------------

        const extraction = finalState.extractedData;
        let savedRecords = 0;

        if (extraction && Array.isArray(extraction.data)) {
            if (extraction.type === "schedule") {
                for (const c of extraction.data) {
                    // Keep mapping simple for the demo
                    await prisma.classSchedule.create({
                        data: {
                            userId: user.id,
                            courseCode: c.courseCode,
                            courseTitle: c.courseTitle,
                            days: c.days,
                            startTime: c.startTime,
                            endTime: c.endTime,
                            building: c.building,
                            room: c.room,
                            instructor: c.instructor,
                            term: "Current"
                        }
                    });
                    savedRecords++;
                }
            } else if (extraction.type === "courses") {
                for (const c of extraction.data) {
                    await prisma.course.create({
                        data: {
                            userId: user.id,
                            canvasId: Math.floor(Math.random() * 100000), // Mock canvas ID from scraper
                            name: c.name,
                            code: c.code,
                            term: c.term
                        }
                    });
                    savedRecords++;
                }
            }
        }

        // Update sync timestamp
        await prisma.user.update({
            where: { id: user.id },
            data: { lastSyncAt: new Date() }
        });

        return NextResponse.json({
            success: true,
            platformScraped: finalState.platform,
            recordsSaved: savedRecords,
            data: extraction
        });

    } catch (error: any) {
        console.error("[LangGraph API] Unhandled Error:", error);
        return NextResponse.json({ error: "Agentic execution failed", details: error.message }, { status: 500 });
    }
}
