"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

interface CalendarItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: string;
  color: string;
  meta?: Record<string, unknown>;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  class: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "Class" },
  assignment: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Assignment" },
  event: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "Event" },
  study_session: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", label: "Study Session" },
  free_food: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", label: "Free Food" },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getCalendar();
        setItems(res.events as unknown as CalendarItem[]);
      } catch {
        // Show empty calendar
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getItemsForDate = (dateStr: string) => {
    return items.filter((item) => {
      const itemDate = new Date(item.start).toISOString().split("T")[0];
      return itemDate === dateStr;
    });
  };

  const selectedItems = selectedDate ? getItemsForDate(selectedDate) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          All your classes, assignments, events, and study sessions in one view.
        </p>
      </div>

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
                        className={`text-xs font-medium ${isToday ? "text-primary font-bold" : ""
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
                          {new Date(item.start).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className={`font-medium text-sm ${style.text}`}>
                        {item.title}
                      </p>
                      {item.type === "free_food" && (
                        <p className="text-xs mt-1">🍕 Free food available!</p>
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
