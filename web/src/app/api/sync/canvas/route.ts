import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const CANVAS_API = "https://canvas.unl.edu/api/v1";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fetch all pages of a paginated Canvas API endpoint.
 */
async function canvasFetchAll(path: string, token: string): Promise<any[]> {
    const results: any[] = [];
    let url: string | null = `${CANVAS_API}${path}`;

    while (url) {
        const response: Response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            throw new Error(`Canvas API ${response.status}: ${url}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
            results.push(...data);
        } else {
            results.push(data);
        }

        // Parse Link header for next page
        const linkHeader: string | null = response.headers.get("Link");
        url = null;
        if (linkHeader) {
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (nextMatch) url = nextMatch[1];
        }
    }

    return results;
}

/**
 * POST /api/sync/canvas
 * Server-side Canvas sync using the user's stored personal access token.
 */
export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.canvasToken) {
        return NextResponse.json(
            { error: "No Canvas token set. Go to Settings to add your Canvas access token." },
            { status: 400 }
        );
    }

    const token = user.canvasToken;

    try {
        // 1. Fetch ALL courses
        const rawCourses = await canvasFetchAll(
            "/courses?per_page=50&include[]=term&include[]=total_scores",
            token
        );

        const courses = rawCourses.filter((c: any) => c.id && c.name);
        let coursesUpserted = 0;

        for (const c of courses) {
            await prisma.course.upsert({
                where: {
                    canvasId_userId: {
                        userId: user.id,
                        canvasId: BigInt(c.id),
                    },
                },
                update: {
                    name: c.name?.substring(0, 200) || "Unknown Course",
                    code: c.course_code?.substring(0, 50) || null,
                    term: c.term?.name?.substring(0, 50) || null,
                },
                create: {
                    userId: user.id,
                    canvasId: BigInt(c.id),
                    name: c.name?.substring(0, 200) || "Unknown Course",
                    code: c.course_code?.substring(0, 50) || null,
                    term: c.term?.name?.substring(0, 50) || null,
                },
            });
            coursesUpserted++;
        }

        // 2. Fetch assignments for all courses
        let assignmentsUpserted = 0;

        for (const c of courses) {
            try {
                const rawAssignments = await canvasFetchAll(
                    `/courses/${c.id}/assignments?per_page=50&include[]=submission`,
                    token
                );

                const dbCourse = await prisma.course.findUnique({
                    where: {
                        canvasId_userId: {
                            userId: user.id,
                            canvasId: BigInt(c.id),
                        },
                    },
                });

                if (!dbCourse) continue;

                for (const a of rawAssignments) {
                    if (!a.id || !a.name) continue;

                    const submission = a.submission || {};

                    await prisma.assignment.upsert({
                        where: {
                            canvasId_userId: {
                                userId: user.id,
                                canvasId: BigInt(a.id),
                            },
                        },
                        update: {
                            name: a.name?.substring(0, 500) || "Untitled Assignment",
                            dueAt: a.due_at ? new Date(a.due_at) : null,
                            pointsPossible: a.points_possible ?? null,
                            score: submission.score ?? null,
                            submittedAt: submission.submitted_at
                                ? new Date(submission.submitted_at)
                                : null,
                            hasSubmitted: Boolean(submission.submitted_at),
                        },
                        create: {
                            userId: user.id,
                            courseId: dbCourse.id,
                            canvasId: BigInt(a.id),
                            name: a.name?.substring(0, 500) || "Untitled Assignment",
                            dueAt: a.due_at ? new Date(a.due_at) : null,
                            pointsPossible: a.points_possible ?? null,
                            score: submission.score ?? null,
                            submittedAt: submission.submitted_at
                                ? new Date(submission.submitted_at)
                                : null,
                            hasSubmitted: Boolean(submission.submitted_at),
                        },
                    });
                    assignmentsUpserted++;
                }
            } catch (err) {
                console.warn(`[Canvas Sync] Skipping course ${c.id}:`, err);
            }
        }

        // 3. Fetch grades (enrollments for overall course grades)
        let gradesUpserted = 0;

        for (const c of courses) {
            try {
                const enrollments = await canvasFetchAll(
                    `/courses/${c.id}/enrollments?user_id=self&include[]=grades`,
                    token
                );

                const dbCourse = await prisma.course.findUnique({
                    where: {
                        canvasId_userId: {
                            userId: user.id,
                            canvasId: BigInt(c.id),
                        },
                    },
                });

                if (!dbCourse) continue;

                for (const e of enrollments) {
                    const grades = e.grades || {};
                    if (grades.current_score != null || grades.final_score != null) {
                        // Update the course-level grade fields
                        await prisma.course.update({
                            where: { id: dbCourse.id },
                            data: {
                                currentGrade: grades.current_grade || null,
                                currentScore: grades.current_score ?? null,
                            },
                        });

                        // Also create a grade history snapshot
                        await prisma.gradeHistory.create({
                            data: {
                                userId: user.id,
                                courseId: dbCourse.id,
                                score: grades.current_score ?? grades.final_score ?? null,
                                pointsPossible: 100, // % based
                            },
                        });
                        gradesUpserted++;
                    }
                }
            } catch {
                // Skip
            }
        }

        // Update last sync timestamp
        await prisma.user.update({
            where: { id: user.id },
            data: { lastSyncAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            synced: {
                courses: coursesUpserted,
                assignments: assignmentsUpserted,
                grades: gradesUpserted,
            },
        });
    } catch (error) {
        console.error("[Canvas Sync] Error:", error);
        return NextResponse.json(
            { error: "Canvas sync failed. Your token may have expired." },
            { status: 500 }
        );
    }
}
