"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";

interface FeedItem {
  id: string;
  type: string;
  data: Record<string, string | number>;
  createdAt: string;
  userName: string;
}

interface ConnectionItem {
  id: string;
  displayName: string;
  email: string;
  status: string;
}

export default function SocialPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [feedRes, connRes] = await Promise.allSettled([
          api.getFeed(),
          api.getConnections(),
        ]);
        if (feedRes.status === "fulfilled") {
          // API returns { feedItems } or { items }
          const raw = feedRes.value as Record<string, unknown>;
          const items = (raw.feedItems || raw.items || []) as Record<string, unknown>[];
          setFeed(items.map((item) => ({
            id: item.id as string,
            type: item.type as string,
            data: (item.data || {}) as Record<string, string | number>,
            createdAt: item.createdAt as string,
            userName: (item as Record<string, unknown> & { user?: { displayName?: string } }).user?.displayName || "Student",
          })));
        }
        if (connRes.status === "fulfilled") {
          const raw = connRes.value as Record<string, unknown>;
          setConnections((raw.connections || []) as unknown as ConnectionItem[]);
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const feedIcon = (type: string) => {
    switch (type) {
      case "session_created":
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Social</h1>
        <p className="text-muted-foreground">
          Connect with fellow students, see what your friends are up to.
        </p>
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Activity Feed</TabsTrigger>
          <TabsTrigger value="connections">
            Connections{" "}
            {connections.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {connections.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">
              Loading feed...
            </p>
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
                        <span className="mr-1">
                          {feedIcon(item.type)}
                        </span>
                        <span className="font-medium">{item.userName}</span>{" "}
                        {item.type === "session_created"
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
            <p className="text-center text-muted-foreground py-8">
              Loading connections...
            </p>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="text-4xl">🤝</span>
                <h3 className="mt-4 font-semibold">No Connections Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Join study sessions to meet classmates!
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
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {conn.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conn.email}
                      </p>
                    </div>
                    <Badge
                      variant={
                        conn.status === "accepted" ? "secondary" : "outline"
                      }
                    >
                      {conn.status}
                    </Badge>
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
