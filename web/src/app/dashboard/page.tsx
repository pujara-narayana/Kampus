"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api-client";
import Link from "next/link";
import { toast } from "sonner";
import {
  Pizza,
  Play,
  Trash2,
  BookOpen,
  Target,
  FileText,
  Bell,
  CalendarDays,
  ClipboardList,
  PartyPopper,
  Users,
  ChevronRight,
  Sparkles,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CourseWithGrade {
  id: string;
  name: string | null;
  code: string | null;
  term: string | null;
  currentGrade: string | null;
  currentScore: number | null;
}

interface ClassScheduleItem {
  id: string;
  courseCode: string | null;
  courseTitle: string | null;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  building: string | null;
  room: string | null;
}

interface DashboardData {
  upcomingAssignments: any[];
  upcomingEvents: any[];
  activeSessions: any[];
  notifications: any[];
  courses: CourseWithGrade[];
  classSchedule: ClassScheduleItem[];
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
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`;

      const [assignmentsRes, eventsRes, sessionsRes, notifRes, coursesRes, calendarRes] =
        await Promise.allSettled([
          api.getUpcomingAssignments(),
          api.getEvents(),
          api.getSessions(),
          api.getNotifications(),
          api.getCourses(),
          api.getCalendar(from, to),
        ]);

      const calendar = calendarRes.status === "fulfilled" ? calendarRes.value : null;
      const classSchedule = (calendar as any)?.classes ?? [];

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
        classSchedule: Array.isArray(classSchedule) ? classSchedule : [],
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
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-14 w-full rounded-lg" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const assignments = data?.upcomingAssignments || [];
  const events = data?.upcomingEvents || [];
  const sessions = data?.activeSessions || [];
  const courses = data?.courses || [];
  const classSchedule = data?.classSchedule || [];
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
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your campus life, unified. Never miss free food again."
      >
        <div className="flex gap-2">
          <Button
            onClick={handleSeed}
            disabled={seeding}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {seeding ? "Seeding…" : "Load Demo Data"}
          </Button>
          <Button
            onClick={handleClearDemo}
            disabled={clearing}
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            {clearing ? "Clearing…" : "Remove Demo Data"}
          </Button>
        </div>
      </PageHeader>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assignments Due
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{assignments.length}</div>
            <p className="text-xs text-muted-foreground">upcoming</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Events Today
            </CardTitle>
            <PartyPopper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{events.length}</div>
            <p className="text-xs text-muted-foreground">on campus</p>
          </CardContent>
        </Card>
        <Card
          className={
            freeFoodEvents.length > 0
              ? "border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/10 transition-shadow hover:shadow-md"
              : "transition-shadow hover:shadow-md"
          }
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Free Food
            </CardTitle>
            <Pizza className="h-4 w-4 text-[#D00000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 tabular-nums">
              {freeFoodEvents.length > 0 ? freeFoodEvents.length : "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {freeFoodEvents.length > 0 ? "events with food!" : "none right now"}
            </p>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Study Sessions
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">active</p>
          </CardContent>
        </Card>
      </div>

      {/* Your classes (synced from MyRed) */}
      <Card className="transition-shadow hover:shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              Your classes
            </span>
            <Link href="/dashboard/calendar">
              <Button variant="ghost" size="sm" className="gap-1">
                View on Calendar
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classSchedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No class schedule yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Use &quot;Sync MyRed Schedule&quot; in Settings or the extension to pull your classes from MyRed.
              </p>
              <Link href="/dashboard/settings" className="mt-4">
                <Button variant="outline" size="sm">Go to Settings</Button>
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {classSchedule.map((cls: ClassScheduleItem) => (
                <li key={cls.id} className="flex items-center justify-between text-sm py-2.5 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30 rounded px-2 -mx-2">
                  <span className="font-medium">{cls.courseCode || cls.courseTitle || "Class"}</span>
                  <span className="text-muted-foreground">
                    {cls.days || "—"} {cls.startTime && cls.endTime ? `${cls.startTime}–${cls.endTime}` : ""}
                    {cls.building ? ` · ${cls.building}${cls.room ? ` ${cls.room}` : ""}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Free Food Alert */}
      {freeFoodEvents.length > 0 && !hideFreeFoodAlerts && (
        <Card className="border-orange-400/60 bg-orange-50 dark:bg-orange-950/20 shadow-sm">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <Pizza className="h-6 w-6 text-[#D00000]" />
            </div>
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
      <Card className="transition-shadow hover:shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              Course Grades
            </span>
            <Link href="/dashboard/insights">
              <Button variant="ghost" size="sm" className="gap-1">
                Insights
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No courses yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Sync from Canvas via the Kampus extension to see grades here.
              </p>
            </div>
          ) : coursesWithGrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Grades syncing</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Grades will appear here after the extension syncs from Canvas.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(gradesExpanded
                ? coursesWithGrades
                : collapsedList
              ).map((c: CourseWithGrade) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
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
        <Card className="transition-shadow hover:shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Upcoming Assignments
              </span>
              <Link href="/dashboard/calendar">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/20 p-4 mb-3">
                  <ClipboardList className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No upcoming assignments right now.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.slice(0, 5).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
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
        <Card className="transition-shadow hover:shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                Notifications
                {unreadNotifs.length > 0 && (
                  <Badge className="ml-1" variant="default">{unreadNotifs.length}</Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unreadNotifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-4 mb-3">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">All read</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No new notifications.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {unreadNotifs.slice(0, 5).map((n: any) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
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
        <Card className="transition-shadow hover:shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Study Sessions
              </span>
              <Link href="/dashboard/sessions">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-4 mb-3">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No study sessions</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create one and find study buddies.
                </p>
                <Link href="/dashboard/sessions" className="mt-4">
                  <Button size="sm">Create Session</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 3).map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
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
        <Card className="transition-shadow hover:shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-muted-foreground" />
                Upcoming Events
              </span>
              <Link href="/dashboard/events">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-4 mb-3">
                  <PartyPopper className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No upcoming events</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check back for campus events and free food.
                </p>
                <Link href="/dashboard/events" className="mt-4">
                  <Button variant="outline" size="sm">Browse Events</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(0, 4).map((e: any) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
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
