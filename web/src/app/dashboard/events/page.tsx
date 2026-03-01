"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { Pizza, MapPin, Clock } from "lucide-react";
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

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [addingToCalendarId, setAddingToCalendarId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getEvents();
        setEvents(res.events as unknown as EventItem[]);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredEvents =
    filter === "free-food"
      ? events.filter((e) => e.hasFreeFood)
      : filter === "academic"
        ? events.filter((e) => e.eventType === "academic")
        : filter === "social"
          ? events.filter((e) => e.eventType === "social")
          : events;

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
        toast.success("Added to Google Calendar!");
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
      {events.some((e) => e.hasFreeFood) && (
        <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-4 py-4">
            <Pizza className="w-8 h-8 text-[#D00000]" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-700 dark:text-orange-300">
                FREE FOOD SPOTTED!
              </h3>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {events.filter((e) => e.hasFreeFood).length} event(s) with free
                food right now!
              </p>
            </div>
            <Button
              variant={filter === "free-food" ? "default" : "outline"}
              className="border-orange-400"
              onClick={() =>
                setFilter(filter === "free-food" ? "all" : "free-food")
              }
            >
              {filter === "free-food" ? "Show All" : "Show Free Food"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="free-food" className="flex items-center gap-1.5"><Pizza className="w-4 h-4" /> Free Food</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <Card
                  key={event.id}
                  className={`flex h-full flex-col ${event.hasFreeFood
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
                      <CardTitle className="text-base leading-tight flex items-center">
                        {event.hasFreeFood && (
                          <Pizza className="w-4 h-4 mr-2 text-[#D00000]" />
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
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {event.building || "TBD"}
                        {event.room ? ` ${event.room}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
