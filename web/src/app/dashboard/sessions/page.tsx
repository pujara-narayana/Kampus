"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface Session {
  id: string;
  title: string;
  description: string | null;
  courseId?: string | null;
  courseName: string | null;
  building: string | null;
  room: string | null;
  startTime: string;
  endTime: string | null;
  maxParticipants: number;
  participantCount: number;
  status: string;
  creatorName: string;
  isCreator: boolean;
  hasJoined: boolean;
}

interface InviteUser {
  id: string;
  displayName: string | null;
  avatarUrl?: string | null;
}

export default function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteSessionId, setInviteSessionId] = useState<string | null>(null);
  const [inviteUsers, setInviteUsers] = useState<InviteUser[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const res = await api.getSessions();
      setSessions(res.sessions as unknown as Session[]);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.createSession({
        title: form.get("title"),
        description: form.get("description"),
        building: form.get("building"),
        room: form.get("room"),
        startTime: form.get("startTime"),
        endTime: form.get("endTime"),
        maxParticipants: parseInt(form.get("maxParticipants") as string) || 10,
      });
      toast.success("Study session created!");
      setDialogOpen(false);
      loadSessions();
    } catch {
      toast.error("Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(sessionId: string) {
    try {
      await api.joinSession(sessionId);
      toast.success("Joined session!");
      loadSessions();
    } catch {
      toast.error("Failed to join session");
    }
  }

  const openInvite = useCallback(
    async (session: Session) => {
      setInviteSessionId(session.id);
      setSelectedUserIds(new Set());
      setInviteLoading(true);
      const myId = user?.id;
      try {
        const [peopleRes, connRes] = await Promise.allSettled([
          api.getPeople(),
          api.getConnections(),
        ]);
        const people: InviteUser[] =
          peopleRes.status === "fulfilled"
            ? ((peopleRes.value as { people?: InviteUser[] }).people || [])
            : [];
        const connections =
          connRes.status === "fulfilled"
            ? ((connRes.value as { connections?: Record<string, unknown>[] }).connections || [])
            : [];
        const friends: InviteUser[] =
          myId
            ? connections
                .filter((c: Record<string, unknown>) => (c.status as string) === "accepted")
                .map((c: Record<string, unknown>) => {
                  const requester = c.requester as Record<string, unknown> | undefined;
                  const receiver = c.receiver as Record<string, unknown> | undefined;
                  const requesterId = c.requesterId as string;
                  const other = requesterId === myId ? receiver : requester;
                  return {
                    id: other?.id as string,
                    displayName: (other?.displayName as string | null) ?? null,
                    avatarUrl: (other?.avatarUrl as string | null) ?? null,
                  } as InviteUser;
                })
                .filter((u) => u.id)
            : [];
        const seen = new Set<string>();
        const merged: InviteUser[] = [];
        for (const u of [...friends, ...people]) {
          if (u.id && !seen.has(u.id)) {
            seen.add(u.id);
            merged.push(u);
          }
        }
        setInviteUsers(merged);
      } catch {
        setInviteUsers([]);
      } finally {
        setInviteLoading(false);
      }
    },
    [user?.id]
  );

  async function handleInviteSubmit() {
    if (!inviteSessionId || selectedUserIds.size === 0) return;
    setInviting(true);
    try {
      const res = await api.inviteToSession(inviteSessionId, Array.from(selectedUserIds));
      toast.success(res.message || `Invited ${res.invited} user(s).`);
      setInviteSessionId(null);
      loadSessions();
    } catch {
      toast.error("Failed to send invites");
    } finally {
      setInviting(false);
    }
  }

  const toggleInviteUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Study Sessions</h1>
          <p className="text-muted-foreground">
            Find study buddies or create your own study group.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Session</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Study Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="CSCE 361 Midterm Prep"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Let's review chapters 5-8 together..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="building">Building</Label>
                  <Input
                    id="building"
                    name="building"
                    placeholder="Love Library"
                  />
                </div>
                <div>
                  <Label htmlFor="room">Room</Label>
                  <Input id="room" name="room" placeholder="2nd Floor" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    name="startTime"
                    type="datetime-local"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="datetime-local"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  defaultValue="10"
                  min="2"
                  max="50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create Session"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">
          Loading sessions...
        </p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-4xl">📚</span>
            <h3 className="mt-4 font-semibold">No Study Sessions Yet</h3>
            <p className="text-muted-foreground mt-2">
              Be the first to create a study session for your courses!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{session.title}</CardTitle>
                  <Badge
                    variant={
                      session.status === "active"
                        ? "default"
                        : session.status === "upcoming"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {session.status}
                  </Badge>
                </div>
                {(session as any).course?.name && (
                  <p className="text-xs text-muted-foreground">
                    {(session as any).course.code || (session as any).course.name}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>📍</span>
                  <span>
                    {session.building || "TBD"}
                    {session.room ? ` ${session.room}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>🕐</span>
                  <span>
                    {new Date(session.startTime).toLocaleDateString()} at{" "}
                    {new Date(session.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>👥</span>
                  <span>
                    {(session as any)._count?.participants ?? session.participantCount ?? 0}/{session.maxParticipants} joined
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created by {(session as any).creator?.displayName || session.creatorName || "Unknown"}
                </p>
                {session.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {session.description}
                  </p>
                )}
                <div className="pt-2 flex flex-wrap gap-2">
                  {session.isCreator && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openInvite(session)}
                    >
                      Invite
                    </Button>
                  )}
                  {session.isCreator ? (
                    <Badge variant="outline">Your Session</Badge>
                  ) : session.hasJoined ? (
                    <Badge>Joined</Badge>
                  ) : ((session as any)._count?.participants ?? session.participantCount ?? 0) < session.maxParticipants ? (
                    <Button
                      size="sm"
                      onClick={() => handleJoin(session.id)}
                      className="w-full"
                    >
                      Join Session
                    </Button>
                  ) : (
                    <Badge variant="destructive">Full</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!inviteSessionId} onOpenChange={(open) => !open && setInviteSessionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to session</DialogTitle>
          </DialogHeader>
          {inviteLoading ? (
            <p className="text-sm text-muted-foreground">Loading people...</p>
          ) : inviteUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one to invite right now. Sync courses or add connections in Social to see classmates.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Select classmates to invite (from your courses or connections).
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {inviteUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleInviteUser(u.id)}
                    />
                    <span className="text-sm font-medium">
                      {u.displayName || "Student"}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                onClick={handleInviteSubmit}
                disabled={selectedUserIds.size === 0 || inviting}
              >
                {inviting ? "Sending…" : `Invite ${selectedUserIds.size} user(s)`}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
