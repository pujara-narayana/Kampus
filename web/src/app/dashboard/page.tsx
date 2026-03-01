"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import Link from "next/link";
import { toast } from "sonner";
import { Pizza, Play, Trash2, BookOpen, Target, FileText, Bell } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CourseWithGrade {
  id: string;
  name: string | null;
  code: string | null;
  term: string | null;
  currentGrade: string | null;
  currentScore: number | null;
}

interface DashboardData {
  upcomingAssignments: any[];
  upcomingEvents: any[];
  activeSessions: any[];
  notifications: any[];
  courses: CourseWithGrade[];
}


/** Parse term like "Spring 2026" or "Fall 2025" to a sort key (higher = more recent). */
function termSortKey(term: string | null): number {
  if (!term || !term.trim()) return 0;
  const s = term.trim();
  const yearMatch = s.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  const lower = s.toLowerCase();
  // Spring < Summer < Fall within a year (chronological order)
  let season = 0;
  if (lower.includes("spring")) season = 1;
  else if (lower.includes("summer")) season = 2;
  else if (lower.includes("fall")) season = 3;
  return year * 10 + season;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [gradesExpanded, setGradesExpanded] = useState(false);
  const [hideFreeFoodAlerts, setHideFreeFoodAlerts] = useState(false);
  const [hidingFreeFood, setHidingFreeFood] = useState(false);

  async function loadData() {
    try {
      const [assignmentsRes, eventsRes, sessionsRes, notifRes, coursesRes] =
        await Promise.allSettled([
          api.getUpcomingAssignments(),
          api.getEvents(),
          api.getSessions(),
          api.getNotifications(),
          api.getCourses(),
        ]);

      setData({
        upcomingAssignments:
          assignmentsRes.status === "fulfilled"
            ? (assignmentsRes.value.assignments ?? [])
            : [],
        upcomingEvents:
          eventsRes.status === "fulfilled"
            ? (eventsRes.value.events ?? [])
            : [],
        activeSessions:
          sessionsRes.status === "fulfilled"
            ? (sessionsRes.value.sessions ?? [])
            : [],
        notifications:
          notifRes.status === "fulfilled"
            ? (notifRes.value.notifications ?? [])
            : [],
        courses:
          coursesRes.status === "fulfilled"
            ? (coursesRes.value.courses ?? [])
            : [],
      });
    } catch {
      // Silently handle - show empty state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    api.getSettings().then((s) => setHideFreeFoodAlerts(s.hideFreeFoodAlerts ?? false)).catch(() => {});
  }, []);

  async function handleAcceptSessionInvite(sessionId: string) {
    try {
      await api.joinSession(sessionId);
      toast.success("Joined session! Check the Group Chat in Messages.");
      await loadData();
    } catch {
      toast.error("Failed to join session");
    }
  }

  async function handleDeclineSessionInvite(sessionId: string) {
    try {
      await api.declineSessionInvite(sessionId);
      toast.success("Invite declined");
      await loadData();
    } catch {
      toast.error("Failed to decline invite");
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await api.seed();
      toast.success("Demo data seeded! Refreshing...");
      setLoading(true);
      await loadData();
    } catch {
      toast.error("Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  }

  async function handleClearDemo() {
    setClearing(true);
    try {
      await api.clearDemoData();
      toast.success("Demo data removed. Refreshing...");
      setLoading(true);
      await loadData();
    } catch {
      toast.error("Failed to remove demo data");
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const assignments = data?.upcomingAssignments || [];
  const events = data?.upcomingEvents || [];
  const sessions = data?.activeSessions || [];
  const courses = data?.courses || [];
  const unreadNotifs = (data?.notifications || []).filter((n: any) => !n.read);
  const freeFoodEvents = events.filter((e: any) => e.hasFreeFood);
  const coursesWithGrades = courses
    .filter(
      (c: CourseWithGrade) => c.currentGrade != null || c.currentScore != null
    )
    .sort(
      (a, b) => termSortKey(b.term) - termSortKey(a.term)
    );
  // Collapsed: show all courses for current semester, or first N if that's a lot
  const currentTermKey =
    coursesWithGrades.length > 0
      ? termSortKey(coursesWithGrades[0].term)
      : 0;
  const currentSemesterCourses = coursesWithGrades.filter(
    (c) => termSortKey(c.term) === currentTermKey
  );
  const GRADES_COLLAPSED_LIMIT = 5;
  // When collapsed: show current semester only, but cap at GRADES_COLLAPSED_LIMIT so "Show more" appears
  const collapsedList =
    currentSemesterCourses.slice(0, GRADES_COLLAPSED_LIMIT);
  const hasMoreToShow =
    coursesWithGrades.length > collapsedList.length;
  const hiddenCount = coursesWithGrades.length - collapsedList.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Your campus life, unified. Never miss free food again.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSeed} disabled={seeding} variant="outline" className="flex items-center gap-2">
            <Play className="w-4 h-4" /> {seeding ? "Seeding..." : "Load Demo Data"}
          </Button>
          <Button
            onClick={handleClearDemo}
            disabled={clearing}
            variant="outline"
            className="text-muted-foreground hover:text-destructive flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> {clearing ? "Clearing..." : "Remove Demo Data"}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assignments Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
            <p className="text-xs text-muted-foreground">upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Events Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">on campus</p>
          </CardContent>
        </Card>
        <Card className={freeFoodEvents.length > 0 ? "border-orange-400" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Free Food
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {freeFoodEvents.length > 0 ? <><Pizza className="w-6 h-6 text-[#D00000]" /> {freeFoodEvents.length}</> : "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {freeFoodEvents.length > 0 ? "events with food!" : "none right now"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Study Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">active</p>
          </CardContent>
        </Card>
      </div>

      {/* Free Food Alert */}
      {freeFoodEvents.length > 0 && !hideFreeFoodAlerts && (
        <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <Pizza className="w-8 h-8 text-[#D00000]" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                FREE FOOD ALERT!
              </h3>
              {freeFoodEvents.map((e: any) => (
                <p key={e.id} className="text-sm">
                  {e.title} at {e.building || "Campus"}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/events?filter=free-food">
                <Button variant="outline" className="border-orange-400">
                  View All
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                disabled={hidingFreeFood}
                onClick={async () => {
                  setHidingFreeFood(true);
                  try {
                    await api.updateSettings({ hideFreeFoodAlerts: true });
                    setHideFreeFoodAlerts(true);
                    toast.success("Free food alerts hidden. You can turn them back on in Settings.");
                  } catch {
                    toast.error("Could not update preference.");
                  } finally {
                    setHidingFreeFood(false);
                  }
                }}
              >
                {hidingFreeFood ? "..." : "Hide"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Grades (synced by extension) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Course Grades</span>
            <Link href="/dashboard/insights">
              <Button variant="ghost" size="sm">
                Insights
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No courses yet. Sync from Canvas via the extension.
            </p>
          ) : coursesWithGrades.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Grades will appear here after the extension syncs from Canvas.
            </p>
          ) : (
            <div className="space-y-2">
              {(gradesExpanded
                ? coursesWithGrades
                : collapsedList
              ).map((c: CourseWithGrade) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {c.name || c.code || "Course"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.code || ""} {c.term ? `· ${c.term}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.currentGrade != null && (
                      <Badge variant="secondary">{c.currentGrade}</Badge>
                    )}
                    {c.currentScore != null && (
                      <span className="text-sm font-medium tabular-nums">
                        {c.currentScore.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {hasMoreToShow && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setGradesExpanded((e) => !e)}
                >
                  {gradesExpanded
                    ? "Show less"
                    : `Show more (${hiddenCount} more)`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upcoming Assignments</span>
              <Link href="/dashboard/calendar">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming assignments. You&apos;re all caught up!
              </p>
            ) : (
              <div className="space-y-3">
                {assignments.slice(0, 5).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.course?.code || a.course?.name || a.courseName || ""}
                      </p>
                    </div>
                    <div className="text-right">
                      {a.hasSubmitted ? (
                        <Badge variant="secondary">Submitted</Badge>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Due{" "}
                            {a.dueAt
                              ? new Date(a.dueAt).toLocaleDateString()
                              : "N/A"}
                          </p>
                          {a.estimatedHours && (
                            <Badge variant="outline">
                              ~{a.estimatedHours}h
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Notifications{" "}
                {unreadNotifs.length > 0 && (
                  <Badge className="ml-2">{unreadNotifs.length}</Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unreadNotifs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No new notifications.
              </p>
            ) : (
              <div className="space-y-3">
                {unreadNotifs.slice(0, 5).map((n: any) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <span className="mt-0.5">
                      {n.type === "free_food_nearby"
                        ? <Pizza className="w-4 h-4 text-orange-500" />
                        : n.type === "assignment_due_soon"
                          ? <FileText className="w-4 h-4 text-blue-500" />
                          : n.type === "session_invite"
                            ? <BookOpen className="w-4 h-4 text-purple-500" />
                            : n.type === "event_recommendation"
                              ? <Target className="w-4 h-4 text-emerald-500" />
                              : <Bell className="w-4 h-4 text-muted-foreground" />}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {n.body}
                        </p>
                      )}
                      {n.type === "session_invite" && n.data?.sessionId && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAcceptSessionInvite(n.data.sessionId as string)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleDeclineSessionInvite(n.data.sessionId as string)}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Study Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Study Sessions</span>
              <Link href="/dashboard/sessions">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No study sessions. Create one!
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 3).map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.building || "TBD"} • {s.course?.code || ""}
                      </p>
                    </div>
                    <Badge>{s._count?.participants ?? s.participantCount ?? 0} joined</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upcoming Events</span>
              <Link href="/dashboard/events">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming events found.
              </p>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 4).map((e: any) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {e.hasFreeFood && <Pizza className="w-4 h-4 text-[#D00000]" />}
                      <div>
                        <p className="font-medium text-sm">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.building || "Campus"} —{" "}
                          {new Date(e.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    {e.hasFreeFood && (
                      <Badge className="bg-orange-500">Free Food</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
