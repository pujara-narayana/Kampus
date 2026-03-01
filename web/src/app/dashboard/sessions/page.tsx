"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Library, MapPin, Clock, Users } from "lucide-react";

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

interface SessionParticipant {
  id: string;
  userId: string;
  status: string;
  user: { id: string; displayName: string | null; avatarUrl: string | null };
}

export default function SessionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showJoinedOnly, setShowJoinedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteSessionId, setInviteSessionId] = useState<string | null>(null);
  const [inviteUsers, setInviteUsers] = useState<InviteUser[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [detailSession, setDetailSession] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      const res = await api.createSession({
        title: form.get("title"),
        description: form.get("description"),
        building: form.get("building"),
        room: form.get("room"),
        startTime: form.get("startTime"),
        endTime: form.get("endTime"),
        maxParticipants: parseInt(form.get("maxParticipants") as string) || 10,
      });
      toast.success(
        res?.googleCalendarAdded
          ? "Study session created and added to Calendar!"
          : "Study session created!"
      );
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
      const res = await api.joinSession(sessionId);
      toast.success(
        res?.googleCalendarAdded
          ? "Joined! Added to Calendar."
          : "Joined session!"
      );
      loadSessions();
    } catch {
      toast.error("Failed to join session");
    }
  }

  async function handleLeave(sessionId: string) {
    try {
      await api.leaveSession(sessionId);
      toast.success("Left session");
      loadSessions();
      if (detailSessionId === sessionId) {
        closeSessionDetail();
      }
    } catch {
      toast.error("Failed to leave session");
    }
  }

  const openInvite = useCallback(
    async (session: Session) => {
      setInviteSessionId(session.id);
      setSelectedUserIds(new Set());
      setInviteLoading(true);
      const myId = user?.id;
      try {
        const [sessionRes, peopleRes, connRes] = await Promise.allSettled([
          api.getSession(session.id),
          api.getPeople(),
          api.getConnections(),
        ]);
        const participants: string[] =
          sessionRes.status === "fulfilled" && sessionRes.value?.session
            ? (Array.isArray((sessionRes.value.session as any).participants)
              ? (sessionRes.value.session as any).participants.map((p: { userId: string }) => p.userId)
              : [])
            : [];
        const alreadyInSession = new Set(participants);
        const people: InviteUser[] =
          peopleRes.status === "fulfilled"
            ? (((peopleRes.value as { people?: unknown[] }).people as InviteUser[]) || [])
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
          if (u.id && !seen.has(u.id) && !alreadyInSession.has(u.id)) {
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
  };

  async function handleEndSession(sessionId: string) {
    try {
      await api.endSession(sessionId);
      toast.success("Session ended");
      loadSessions();
      if (detailSessionId === sessionId) {
        closeSessionDetail();
      }
    } catch {
      toast.error("Failed to end session");
    }
  }

  async function handleRemoveParticipant(sessionId: string, groupChatId: string | undefined, userId: string) {
    if (!groupChatId) {
      toast.error("No group chat found for this session");
      return;
    }
    try {
      await api.removeGroupChatMember(groupChatId, userId);
      toast.success("Participant removed");
      // Refresh detail
      if (detailSessionId) {
        openSessionDetail(detailSessionId);
      }
    } catch {
      toast.error("Failed to remove participant");
    }
  }

  async function handleRevokeInvite(sessionId: string, userId: string) {
    try {
      await api.revokeSessionInvite(sessionId, userId);
      toast.success("Invite revoked");
      if (detailSessionId === sessionId) {
        openSessionDetail(detailSessionId);
      }
      loadSessions();
    } catch {
      toast.error("Failed to revoke invite");
    }
  }

  async function handleCreateGroupChat(sessionId: string) {
    try {
      await api.createSessionGroupChat(sessionId);
      toast.success("Group chat created!");
      closeSessionDetail();
      router.push(`/dashboard/chat?session=${sessionId}`);
    } catch {
      toast.error("Failed to create group chat");
    }
  }

  async function openSessionDetail(sessionId: string) {
    setDetailSessionId(sessionId);
    setDetailLoading(true);
    setDetailSession(null);
    try {
      const res = await api.getSession(sessionId);
      setDetailSession(res.session as Record<string, unknown>);
    } catch {
      setDetailSessionId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeSessionDetail() {
    setDetailSessionId(null);
    setDetailSession(null);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Study Sessions"
        description="Find study buddies or create your own study group."
      >
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showJoinedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowJoinedOnly(!showJoinedOnly)}
              >
                {showJoinedOnly ? "Showing Joined" : "Show Joined Only"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showJoinedOnly ? "Show all sessions" : "Show only sessions you joined"}
            </TooltipContent>
          </Tooltip>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button size="sm">Create Session</Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Create a new study session</TooltipContent>
            </Tooltip>
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
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="space-y-2">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-24 mt-2" />
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-8 flex-1 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.filter(s => !showJoinedOnly || s.hasJoined || s.isCreator).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Library className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">No sessions found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {showJoinedOnly
                ? "You haven't joined any sessions yet. Switch to see all or create your own."
                : "Be the first to create a study session for your courses!"}
            </p>
            {!showJoinedOnly && (
              <Button
                className="mt-4"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                Create Session
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.filter(s => !showJoinedOnly || s.hasJoined || s.isCreator).map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer transition-all duration-200 hover:bg-accent/50 hover:shadow-md flex flex-col"
              onClick={() => openSessionDetail(session.id)}
            >
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
              <CardContent className="space-y-2 flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm mt-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {session.building || "TBD"}
                      {session.room ? ` ${session.room}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {new Date(session.startTime).toLocaleDateString()} at{" "}
                      {new Date(session.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {(session as any)._count?.participants ?? session.participantCount ?? 0}/{session.maxParticipants} joined
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created by {(session as any).creator?.displayName || session.creatorName || "Unknown"}
                  </p>
                  {session.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                      {session.description}
                    </p>
                  )}
                </div>
                <div className="pt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {session.isCreator && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openInvite(session)}
                        >
                          Invite
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Invite friends to this session</TooltipContent>
                    </Tooltip>
                  )}
                  {session.isCreator ? (
                    <Badge variant="outline">Your Session</Badge>
                  ) : session.hasJoined ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleLeave(session.id)}
                          className="w-full"
                        >
                          Leave Session
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Leave this study session</TooltipContent>
                    </Tooltip>
                  ) : ((session as any)._count?.participants ?? session.participantCount ?? 0) < session.maxParticipants ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => handleJoin(session.id)}
                          className="w-full"
                        >
                          Join Session
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Join this study session</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge variant="destructive">Full</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Session detail dialog */}
      <Dialog open={!!detailSessionId} onOpenChange={(open) => !open && closeSessionDetail()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="pt-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              </div>
            </div>
          ) : detailSession ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{String(detailSession.title || "Session")}</h3>
                {(detailSession.creator as any)?.displayName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created by {String((detailSession.creator as any).displayName)}
                  </p>
                )}
              </div>
              {(detailSession.course as any) && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Course:</span>{" "}
                  {String((detailSession.course as any).code || (detailSession.course as any).name || "—")}
                </p>
              )}
              {detailSession.description && (
                <p className="text-sm text-muted-foreground">{String(detailSession.description)}</p>
              )}
              <Separator />
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{detailSession.building ? String(detailSession.building) : "TBD"}{detailSession.room ? ` ${String(detailSession.room)}` : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {detailSession.startTime
                      ? new Date(detailSession.startTime as string).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                      : "—"}
                    {detailSession.endTime ? (
                      <> – {new Date(detailSession.endTime as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {Array.isArray(detailSession.participants) ? detailSession.participants.length : 0} / {Number(detailSession.maxParticipants) || 10} participants
                  </span>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium text-sm mb-2">Participants</h4>
                {(detailSession.participants as SessionParticipant[])?.length > 0 ? (
                  <ul className="space-y-2">
                    {(detailSession.participants as SessionParticipant[]).map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {p.user?.displayName?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1">{p.user?.displayName || "Student"}</span>
                        <Badge variant={p.status === "accepted" ? "secondary" : "outline"} className="text-xs">
                          {p.status}
                        </Badge>
                        {detailSession?.creatorId === user?.id && p.userId !== user?.id && p.status === "invited" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleRevokeInvite(detailSessionId!, p.userId)}
                          >
                            Revoke
                          </Button>
                        )}
                        {detailSession?.creatorId === user?.id && p.userId !== user?.id && p.status === "accepted" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() =>
                              handleRemoveParticipant(
                                detailSessionId!,
                                (detailSession as any).groupChat?.id,
                                p.userId
                              )
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No participants yet.</p>
                )}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Create group chat - any participant, when session has no group chat yet */}
                {(detailSession.creatorId === user?.id ||
                  (Array.isArray(detailSession.participants) && detailSession.participants.some((p: any) => p.userId === user?.id && p.status === "accepted"))) &&
                  !(detailSession as any).groupChat?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateGroupChat(detailSessionId!)}
                    >
                      Create group chat
                    </Button>
                  )}
                {/* Group Chat button - when group chat exists, for creator and accepted participants */}
                {((detailSession as any).groupChat?.id) &&
                  (detailSession.creatorId === user?.id ||
                    (Array.isArray(detailSession.participants) && detailSession.participants.some((p: any) => p.userId === user?.id && p.status === "accepted"))) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        closeSessionDetail();
                        router.push(`/dashboard/chat?session=${detailSessionId}`);
                      }}
                    >
                      Group Chat
                    </Button>
                  )}
                {detailSession.creatorId === user?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const id = detailSessionId!;
                      closeSessionDetail();
                      setInviteSessionId(id);
                      openInvite({ id } as Session);
                    }}
                  >
                    Invite people
                  </Button>
                )}
                {/* End Session button - creator only, for non-completed sessions */}
                {detailSession.creatorId === user?.id && detailSession.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleEndSession(detailSessionId!)}
                  >
                    End Session
                  </Button>
                )}
                {detailSession.creatorId !== user?.id &&
                  !(Array.isArray(detailSession.participants) && detailSession.participants.some((p: any) => p.userId === user?.id)) &&
                  (Array.isArray(detailSession.participants) ? detailSession.participants.length : 0) < (Number(detailSession.maxParticipants) || 0) && (
                    <Button
                      size="sm"
                      onClick={() => {
                        handleJoin(detailSessionId!);
                        closeSessionDetail();
                      }}
                    >
                      Join session
                    </Button>
                  )}
                {(Array.isArray(detailSession.participants) && detailSession.participants.some((p: any) => p.userId === user?.id)) && detailSession.creatorId !== user?.id && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      handleLeave(detailSessionId!);
                    }}
                  >
                    Leave Session
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load session.</p>
          )}
        </DialogContent>
      </Dialog>

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
