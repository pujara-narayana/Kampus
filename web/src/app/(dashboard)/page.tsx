"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import Link from "next/link";

interface DashboardData {
  upcomingAssignments: { id: string; name: string; courseName: string; dueAt: string; estimatedHours: number | null; hasSubmitted: boolean }[];
  upcomingEvents: { id: string; title: string; startTime: string; hasFreeFood: boolean; building: string | null }[];
  activeSessions: { id: string; title: string; participantCount: number; building: string | null; startTime: string }[];
  notifications: { id: string; title: string; type: string; read: boolean }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [assignmentsRes, eventsRes, sessionsRes, notifRes] =
          await Promise.allSettled([
            api.getUpcomingAssignments(),
            api.getEvents(),
            api.getSessions(),
            api.getNotifications(),
          ]);

        setData({
          upcomingAssignments:
            assignmentsRes.status === "fulfilled"
              ? (assignmentsRes.value.assignments as DashboardData["upcomingAssignments"])
              : [],
          upcomingEvents:
            eventsRes.status === "fulfilled"
              ? (eventsRes.value.events as DashboardData["upcomingEvents"])
              : [],
          activeSessions:
            sessionsRes.status === "fulfilled"
              ? (sessionsRes.value.sessions as DashboardData["activeSessions"])
              : [],
          notifications:
            notifRes.status === "fulfilled"
              ? (notifRes.value.notifications as DashboardData["notifications"])
              : [],
        });
      } catch {
        // Silently handle - show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
  const unreadNotifs = (data?.notifications || []).filter((n) => !n.read);
  const freeFoodEvents = events.filter((e) => e.hasFreeFood);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Your campus life, unified. Never miss free food again.
        </p>
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
            <div className="text-2xl font-bold">
              {freeFoodEvents.length > 0 ? `${freeFoodEvents.length}` : "0"}
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
      {freeFoodEvents.length > 0 && (
        <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <span className="text-4xl">🍕</span>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                FREE FOOD ALERT!
              </h3>
              {freeFoodEvents.map((e) => (
                <p key={e.id} className="text-sm">
                  {e.title} at {e.building || "Campus"}
                </p>
              ))}
            </div>
            <Link href="/events?filter=free-food">
              <Button variant="outline" className="border-orange-400">
                View All
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Upcoming Assignments</span>
              <Link href="/calendar">
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
                {assignments.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.courseName}
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
                {unreadNotifs.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <span className="mt-0.5">
                      {n.type === "free_food_nearby"
                        ? "🍕"
                        : n.type === "assignment_due_soon"
                          ? "📝"
                          : n.type === "session_invite"
                            ? "📚"
                            : "🔔"}
                    </span>
                    <p className="text-sm">{n.title}</p>
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
              <span>Active Study Sessions</span>
              <Link href="/sessions">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active study sessions. Create one!
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.building || "TBD"}
                      </p>
                    </div>
                    <Badge>{s.participantCount} joined</Badge>
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
              <Link href="/events">
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
                {events.slice(0, 4).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {e.hasFreeFood && <span>🍕</span>}
                      <div>
                        <p className="font-medium text-sm">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.building || "Campus"} -{" "}
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
