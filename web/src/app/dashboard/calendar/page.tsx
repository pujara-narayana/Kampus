"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { Pizza } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CalendarItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  class: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Class" },
  assignment: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Assignment" },
  event: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "Event" },
  study_session: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", label: "Study Session" },
  free_food: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", label: "Free Food" },
  google: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", label: "Google" },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// Map recurring class schedule into actual dates for the current month view
function generateClassDates(cls: any, year: number, month: number): CalendarItem[] {
  const items: CalendarItem[] = [];
  const dayMap: Record<string, number> = { M: 1, T: 2, W: 3, R: 4, F: 5 };
  const days = (cls.days || "").split("").map((d: string) => dayMap[d]).filter(Boolean);
  const daysInMonth = getDaysInMonth(year, month);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    if (days.includes(dow)) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      items.push({
        id: `class-${cls.id}-${dateStr}`,
        title: `${cls.courseCode || cls.courseTitle || "Class"} (${cls.startTime || ""})`,
        start: `${dateStr}T${cls.startTime || "08:00"}:00`,
        end: cls.endTime ? `${dateStr}T${cls.endTime}:00` : undefined,
        type: "class",
      });
    }
  }
  return items;
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build date range for the current month view (for API and Google Calendar)
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(getDaysInMonth(year, month)).padStart(2, "0")}`;

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getCalendar(from, to);
        const mapped: CalendarItem[] = [];

        // Map classes (recurring schedule)
        const classes = (res as any).classes || [];
        for (const cls of classes) {
          mapped.push(...generateClassDates(cls, year, month));
        }

        // Map assignments
        const assignments = (res as any).assignments || [];
        for (const a of assignments) {
          if (a.dueAt) {
            mapped.push({
              id: `asgn-${a.id}`,
              title: `${a.name} (${a.course?.code || ""})`,
              start: a.dueAt,
              type: "assignment",
            });
          }
        }

        // Campus events are not shown on the calendar (only user's classes,
        // assignments, study sessions, and Google Calendar).

        // Map study sessions
        const studySessions = (res as any).studySessions || [];
        for (const s of studySessions) {
          mapped.push({
            id: `sess-${s.id}`,
            title: `${s.title} (${s.course?.code || "Study"})`,
            start: s.startTime,
            end: s.endTime || undefined,
            type: "study_session",
          });
        }

        // Map Google Calendar events (study sessions → study_session, campus-added → event, else google)
        const googleEvents = (res as any).googleEvents || [];
        const studySessionGcalIds = new Set((res as any).studySessionGoogleEventIds || []);
        const campusAddedIds = new Set((res as any).campusAddedGoogleEventIds || []);
        for (const g of googleEvents) {
          let type = "google";
          if (studySessionGcalIds.has(g.id)) type = "study_session";
          else if (campusAddedIds.has(g.id)) type = "event";
          mapped.push({
            id: `gcal-${g.id}`,
            title: g.title,
            start: g.start,
            end: g.end,
            type,
          });
        }

        setItems(mapped);
        setGoogleConnected(Boolean((res as any).googleConnected));
      } catch {
        // Show empty calendar
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, month, from, to]);

  const handleConnectGoogleCalendar = async () => {
    setGcalConnecting(true);
    try {
      const { redirectUrl } = await api.getGcalAuthUrl();
      window.location.href = redirectUrl;
    } catch {
      setGcalConnecting(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    setGcalDisconnecting(true);
    try {
      await api.disconnectGcal();
      setGoogleConnected(false);
      setItems((prev) => prev.filter((item) => item.type !== "google"));
    } catch {
      // keep connected on error
    } finally {
      setGcalDisconnecting(false);
    }
  };

  const getItemsForDate = (dateStr: string) => {
    return items.filter((item) => {
      const start = item.start;
      const itemDate =
        start.length === 10 && !start.includes("T")
          ? start
          : (() => {
              const d = new Date(start);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            })();
      return itemDate === dateStr;
    });
  };

  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const gcalStatus = searchParams.get("gcal");
  const gcalMessage = searchParams.get("message");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">
            All your classes, assignments, events, and study sessions in one view.
          </p>
        </div>
        {!googleConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectGoogleCalendar}
            disabled={gcalConnecting}
          >
            {gcalConnecting ? "Redirecting…" : "Connect Google Calendar"}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Google Calendar connected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnectGoogleCalendar}
              disabled={gcalDisconnecting}
              className="text-muted-foreground hover:text-foreground"
            >
              {gcalDisconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        )}
      </div>

      {gcalStatus === "connected" && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Google Calendar is now connected. Your events will appear on this calendar.
        </p>
      )}
      {gcalStatus === "error" && (
        <p className="text-sm text-destructive">
          {gcalMessage ? decodeURIComponent(gcalMessage) : "Could not connect Google Calendar."}
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-full ${val.bg} border`} />
            <span className="text-xs text-muted-foreground">{val.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2" ref={calendarRef}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="rounded p-1 hover:bg-accent">
                &larr;
              </button>
              <CardTitle>
                {monthName} {year}
              </CardTitle>
              <button onClick={nextMonth} className="rounded p-1 hover:bg-accent">
                &rarr;
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">
                Loading calendar...
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-px">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayItems = getItemsForDate(dateStr);
                  const isToday = dateStr === new Date().toISOString().split("T")[0];
                  const isSelected = dateStr === selectedDate;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`h-24 rounded-lg border p-1 text-left transition-colors hover:bg-accent ${isToday ? "border-primary" : ""
                        } ${isSelected ? "bg-accent ring-2 ring-primary" : ""}`}
                    >
                      <span
                        className={`text-xs font-medium ${isToday ? "text-[#D00000] font-bold" : ""
                          }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayItems.slice(0, 3).map((item) => {
                          const style = TYPE_COLORS[item.type] || TYPE_COLORS.event;
                          return (
                            <div
                              key={item.id}
                              className={`truncate rounded px-1 text-[10px] ${style.bg} ${style.text}`}
                            >
                              {item.title}
                            </div>
                          );
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayItems.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" }
                )
                : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground">
                Click on a date to see details.
              </p>
            ) : selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled for this day.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedItems.map((item) => {
                  const style = TYPE_COLORS[item.type] || TYPE_COLORS.event;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${style.bg}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge
                          variant="outline"
                          className={style.text}
                        >
                          {style.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.start.length === 10 && !item.start.includes("T")
                            ? "All day"
                            : new Date(item.start).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                        </span>
                      </div>
                      <p className={`font-medium text-sm ${style.text}`}>
                        {item.title}
                      </p>
                      {item.type === "free_food" && (
                        <p className="text-xs mt-1 flex items-center gap-1">
                          <Pizza className="w-3 h-3 text-[#D00000]" />
                          Free food available!
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
