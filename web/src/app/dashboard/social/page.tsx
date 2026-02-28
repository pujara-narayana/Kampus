"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface FeedItem {
  id: string;
  type: string;
  data: Record<string, string | number>;
  createdAt: string;
  userName: string;
}

interface ConnectionRow {
  id: string;
  otherUserId: string;
  displayName: string | null;
  email: string | null;
  status: string;
  direction: "sent" | "received" | "accepted";
}

interface PersonRow {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

function normalizeConnection(conn: Record<string, unknown>, myId: string): ConnectionRow {
  const requester = conn.requester as Record<string, unknown> | undefined;
  const receiver = conn.receiver as Record<string, unknown> | undefined;
  const requesterId = conn.requesterId as string;
  const receiverId = conn.receiverId as string;
  const status = (conn.status as string) || "pending";
  const other = requesterId === myId ? receiver : requester;
  const direction =
    status === "accepted"
      ? "accepted"
      : requesterId === myId
        ? "sent"
        : "received";
  return {
    id: conn.id as string,
    otherUserId: (other?.id as string) || "",
    displayName: (other?.displayName as string | null) ?? null,
    email: (other?.email as string | null) ?? null,
    status,
    direction,
  };
}

export default function SocialPage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const raw = await api.getConnections();
      const list = (raw.connections || []) as Record<string, unknown>[];
      if (user?.id) {
        setConnections(list.map((c) => normalizeConnection(c, user.id!)));
      } else {
        setConnections([]);
      }
    } catch {
      setConnections([]);
    }
  }, [user?.id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [feedRes, connRes] = await Promise.allSettled([
          api.getFeed(),
          api.getConnections(),
        ]);
        if (feedRes.status === "fulfilled") {
          const raw = feedRes.value as Record<string, unknown>;
          const items = (raw.feedItems || raw.items || []) as Record<string, unknown>[];
          setFeed(
            items.map((item) => ({
              id: item.id as string,
              type: item.type as string,
              data: (item.data || {}) as Record<string, string | number>,
              createdAt: item.createdAt as string,
              userName:
                (item as Record<string, unknown> & { user?: { displayName?: string } })
                  .user?.displayName || "Student",
            }))
          );
        }
        if (connRes.status === "fulfilled" && user?.id) {
          const raw = connRes.value as Record<string, unknown>;
          const list = (raw.connections || []) as Record<string, unknown>[];
          setConnections(list.map((c) => normalizeConnection(c as Record<string, unknown>, user.id!)));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  const loadPeople = useCallback(async () => {
    setPeopleLoading(true);
    try {
      const res = await api.getPeople();
      setPeople((res.people || []) as unknown as PersonRow[]);
    } catch {
      setPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  }, []);

  const handleAccept = async (connectionId: string) => {
    setActioningId(connectionId);
    try {
      await api.updateConnection(connectionId, "accept");
      await loadConnections();
    } finally {
      setActioningId(null);
    }
  };

  const handleDecline = async (connectionId: string) => {
    setActioningId(connectionId);
    try {
      await api.updateConnection(connectionId, "decline");
      await loadConnections();
    } finally {
      setActioningId(null);
    }
  };

  const handleSendRequest = async (receiverId: string) => {
    setSendingToId(receiverId);
    try {
      await api.sendConnectionRequest(receiverId);
      setPeople((prev) => prev.filter((p) => p.id !== receiverId));
      await loadConnections();
    } finally {
      setSendingToId(null);
    }
  };

  const feedIcon = (type: string) => {
    switch (type) {
      case "session_created":
      case "study_session_created":
        return "📚";
      case "session_joined":
        return "👥";
      case "assignment_completed":
        return "✅";
      case "streak_achieved":
        return "🔥";
      case "free_food_spotted":
        return "🍕";
      default:
        return "📌";
    }
  };

  const pendingReceivedCount = connections.filter(
    (c) => c.status === "pending" && c.direction === "received"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Social</h1>
        <p className="text-muted-foreground">
          Connect with fellow students, see what your friends are up to.
        </p>
      </div>

      <Tabs defaultValue="feed" onValueChange={(v) => v === "people" && loadPeople()}>
        <TabsList>
          <TabsTrigger value="feed">Activity Feed</TabsTrigger>
          <TabsTrigger value="connections">
            Connections
            {(connections.length > 0 || pendingReceivedCount > 0) && (
              <Badge variant="secondary" className="ml-1">
                {pendingReceivedCount > 0 ? `${pendingReceivedCount} pending` : connections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="people">People in your courses</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading feed...</p>
          ) : feed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="text-4xl">👥</span>
                <h3 className="mt-4 font-semibold">No Activity Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Connect with classmates to see their activity here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {feed.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex items-start gap-3 py-4">
                    <Avatar className="h-8 w-8 mt-0.5">
                      <AvatarFallback>
                        {item.userName?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="mr-1">{feedIcon(item.type)}</span>
                        <span className="font-medium">{item.userName}</span>{" "}
                        {item.type === "session_created" || item.type === "study_session_created"
                          ? `created a study session: "${item.data?.title || ""}"`
                          : item.type === "assignment_completed"
                            ? `completed an assignment in ${item.data?.courseName || ""}`
                            : item.type === "streak_achieved"
                              ? `achieved a ${item.data?.count || ""}-day ${item.data?.type || ""} streak!`
                              : item.type === "free_food_spotted"
                                ? `spotted free food at ${item.data?.location || ""}`
                                : item.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading connections...</p>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="text-4xl">🤝</span>
                <h3 className="mt-4 font-semibold">No Connections Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Go to &quot;People in your courses&quot; to add classmates, or join study sessions to meet people.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {connections.map((conn) => (
                <Card key={conn.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Avatar>
                      <AvatarFallback>
                        {conn.displayName?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {conn.displayName || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conn.email || ""}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant={
                            conn.status === "accepted"
                              ? "secondary"
                              : conn.direction === "received"
                                ? "default"
                                : "outline"
                          }
                        >
                          {conn.status === "accepted"
                            ? "Friends"
                            : conn.direction === "received"
                              ? "Wants to connect"
                              : "Pending"}
                        </Badge>
                        {conn.status === "accepted" && (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/chat?with=${conn.otherUserId}`}>
                              Message
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                    {conn.direction === "received" && conn.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAccept(conn.id)}
                          disabled={actioningId !== null}
                        >
                          {actioningId === conn.id ? "..." : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecline(conn.id)}
                          disabled={actioningId !== null}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="people" className="mt-4">
          {peopleLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : people.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="text-4xl">🎓</span>
                <h3 className="mt-4 font-semibold">No one to show yet</h3>
                <p className="text-muted-foreground mt-2">
                  Sync your courses from Canvas (via the extension) to see classmates here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {people.map((person) => (
                <Card key={person.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Avatar>
                      <AvatarFallback>
                        {person.displayName?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {person.displayName || "Student"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {person.email || ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendRequest(person.id)}
                      disabled={sendingToId !== null}
                    >
                      {sendingToId === person.id ? "Sending…" : "Add"}
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
