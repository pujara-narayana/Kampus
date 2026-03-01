"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  building: string | null;
  room: string | null;
  hasFreeFood: boolean;
  foodDetails: string | null;
  eventType: string | null;
  orgName: string | null;
  eventUrl: string | null;
  imageUrl?: string | null;
}

const EVENTS_PAGE_SIZE = 30;

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState("all");
  const [addingToCalendarId, setAddingToCalendarId] = useState<string | null>(null);
  const [hideFreeFoodAlerts, setHideFreeFoodAlerts] = useState(false);
  const [hidingFreeFood, setHidingFreeFood] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getEvents(false, EVENTS_PAGE_SIZE, 0);
        setEvents((res.events as unknown as EventItem[]) ?? []);
        setTotal(res.total ?? 0);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    api.getSettings().then((s) => setHideFreeFoodAlerts(s.hideFreeFoodAlerts ?? false)).catch(() => {});
  }, []);

  async function loadMore() {
    if (loadingMore || events.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await api.getEvents(false, EVENTS_PAGE_SIZE, events.length);
      const next = (res.events as unknown as EventItem[]) ?? [];
      setEvents((prev) => [...prev, ...next]);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredEvents =
    filter === "free-food" ? events.filter((e) => e.hasFreeFood) : events;

  async function handleAddToCalendar(event: EventItem) {
    setAddingToCalendarId(event.id);
    try {
      const res = await api.addEventToGoogleCalendar({
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime ?? undefined,
        description: event.description ?? undefined,
        location: [event.building, event.room].filter(Boolean).join(", ") || undefined,
      });
      if (res?.googleCalendarAdded) {
        toast.success("Added to Calendar!");
      }
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
      if (code === "NOT_CONNECTED" || (err as { message?: string })?.message?.includes("not connected")) {
        toast.error("Connect Google Calendar on the Calendar page first.");
      } else {
        toast.error("Could not add to Google Calendar.");
      }
    } finally {
      setAddingToCalendarId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground">
          Campus events, org activities, and — most importantly — free food.
        </p>
      </div>

      {/* Free Food Banner */}
      {events.some((e) => e.hasFreeFood) && !hideFreeFoodAlerts && (
        <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <span className="text-4xl">🍕</span>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                FREE FOOD SPOTTED!
              </h3>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {events.filter((e) => e.hasFreeFood).length} event(s) with free
                food right now!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === "free-food" ? "default" : "outline"}
                className="border-orange-400"
                onClick={() =>
                  setFilter(filter === "free-food" ? "all" : "free-food")
                }
              >
                {filter === "free-food" ? "Show All" : "Show Free Food"}
              </Button>
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

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="free-food">🍕 Free Food</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">
              Loading events...
            </p>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No events found. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => (
                <Card
                  key={event.id}
                  className={`flex h-full flex-col ${
                    event.hasFreeFood
                      ? "border-orange-400 dark:border-orange-600"
                      : ""
                  }`}
                >
                  {event.imageUrl && (
                    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-t-lg bg-muted">
                      <img
                        src={event.imageUrl}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <CardHeader className="shrink-0 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base leading-tight">
                        {event.hasFreeFood && (
                          <span className="mr-1">🍕</span>
                        )}
                        {event.title}
                      </CardTitle>
                    </div>
                    {event.orgName && (
                      <p className="text-xs text-muted-foreground">
                        {event.orgName}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span>📍</span>
                      <span>
                        {event.building || "TBD"}
                        {event.room ? ` ${event.room}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>🕐</span>
                      <span>
                        {new Date(event.startTime).toLocaleDateString()} at{" "}
                        {new Date(event.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {event.hasFreeFood && event.foodDetails && (
                      <Badge className="bg-orange-500">
                        {event.foodDetails}
                      </Badge>
                    )}
                    {event.eventType && (
                      <Badge variant="outline">{event.eventType}</Badge>
                    )}
                    {event.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {event.description}
                      </p>
                    )}
                    {event.eventUrl && (
                      <a
                        href={event.eventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View Details →
                      </a>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-auto w-full shrink-0"
                      onClick={() => handleAddToCalendar(event)}
                      disabled={addingToCalendarId !== null}
                    >
                      {addingToCalendarId === event.id
                        ? "Adding…"
                        : "Add to Google Calendar"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              </div>
              {events.length < total && (
                <div className="flex justify-center pt-6">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Show more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
