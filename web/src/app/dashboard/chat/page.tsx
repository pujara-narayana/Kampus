"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  api,
  type ChatConversation,
  type ChatMessage,
  type ChatWithUserResponse,
  type GroupChatSummary,
  type GroupChatDetail,
  type GroupChatMemberInfo,
  type SessionInvite,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 5000;

type ActiveView =
  | { type: "dm"; data: ChatWithUserResponse }
  | { type: "group"; data: GroupChatDetail };

export default function ChatPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");
  const sessionId = searchParams.get("session");

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChatSummary[]>([]);
  const [invites, setInvites] = useState<SessionInvite[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const [dmRes, gcRes, inviteRes] = await Promise.allSettled([
        api.getChatConversations(),
        api.getGroupChats(),
        api.getSessionInvites(),
      ]);
      if (dmRes.status === "fulfilled") setConversations(dmRes.value.conversations || []);
      if (gcRes.status === "fulfilled") setGroupChats(gcRes.value.groupChats || []);
      if (inviteRes.status === "fulfilled") setInvites(inviteRes.value.invites || []);
    } catch {
      // keep existing state
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  const openDM = useCallback(
    async (otherUserId: string) => {
      if (!otherUserId || otherUserId === user?.id) return;
      setLoadingChat(true);
      setShowMembers(false);
      try {
        const res = await api.getChatWithUser(otherUserId);
        setActiveView({ type: "dm", data: res });
        await loadConversations();
      } catch {
        setActiveView(null);
      } finally {
        setLoadingChat(false);
      }
    },
    [user?.id, loadConversations]
  );

  const openGroupChat = useCallback(
    async (groupChatId: string) => {
      setLoadingChat(true);
      setShowMembers(false);
      try {
        const res = await api.getGroupChat(groupChatId);
        setActiveView({ type: "group", data: res });
        await loadConversations();
      } catch {
        setActiveView(null);
      } finally {
        setLoadingChat(false);
      }
    },
    [loadConversations]
  );

  // Open from ?with=userId
  useEffect(() => {
    if (withUserId && user?.id && withUserId !== user.id) {
      openDM(withUserId);
    }
  }, [withUserId, user?.id, openDM]);

  // Open from ?session=sessionId — wait until group chats are loaded
  useEffect(() => {
    if (sessionId && groupChats.length > 0) {
      const gc = groupChats.find((g) => g.sessionId === sessionId);
      if (gc) openGroupChat(gc.id);
    }
  }, [sessionId, groupChats, openGroupChat]);

  // Load on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Polling for active chat
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!activeView) return;

    const poll = async () => {
      try {
        if (activeView.type === "dm") {
          const otherId = activeView.data.conversation.otherUser.id;
          const res = await api.getChatWithUser(otherId);
          setActiveView((prev) =>
            prev?.type === "dm"
              ? { type: "dm", data: { ...res, conversation: prev.data.conversation } }
              : prev
          );
        } else {
          const gcId = activeView.data.groupChat.id;
          const res = await api.getGroupChat(gcId);
          setActiveView({ type: "group", data: res });
        }
      } catch {
        // keep current state
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeView?.type,
    activeView?.type === "dm"
      ? activeView.data.conversation.otherUser.id
      : activeView?.type === "group"
      ? activeView.data.groupChat.id
      : null,
  ]);

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !activeView || sending) return;
    setSending(true);
    try {
      let message: ChatMessage;
      if (activeView.type === "dm") {
        const res = await api.sendChatMessage(activeView.data.conversation.id, text);
        message = res.message;
        setActiveView((prev) =>
          prev?.type === "dm"
            ? { type: "dm", data: { ...prev.data, messages: [...prev.data.messages, message] } }
            : prev
        );
      } else {
        const res = await api.sendGroupChatMessage(activeView.data.groupChat.id, text);
        message = res.message;
        setActiveView((prev) =>
          prev?.type === "group"
            ? { type: "group", data: { ...prev.data, messages: [...prev.data.messages, message] } }
            : prev
        );
      }
      setMessageText("");
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleRemoveMember = async (member: GroupChatMemberInfo) => {
    if (activeView?.type !== "group") return;
    try {
      await api.removeGroupChatMember(activeView.data.groupChat.id, member.userId);
      const res = await api.getGroupChat(activeView.data.groupChat.id);
      setActiveView({ type: "group", data: res });
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleAcceptInvite = async (invite: SessionInvite) => {
    setRespondingInvite(invite.sessionId);
    try {
      await api.joinSession(invite.sessionId);
      toast.success(`Joined "${invite.sessionTitle || "session"}"`);
      await loadConversations();
      // Auto-open the group chat
      const updatedGcs = await api.getGroupChats();
      const gc = updatedGcs.groupChats.find((g) => g.sessionId === invite.sessionId);
      if (gc) openGroupChat(gc.id);
    } catch {
      toast.error("Failed to join session");
    } finally {
      setRespondingInvite(null);
    }
  };

  const handleDeclineInvite = async (invite: SessionInvite) => {
    setRespondingInvite(invite.sessionId);
    try {
      await api.declineSessionInvite(invite.sessionId);
      toast.success("Invite declined");
      await loadConversations();
    } catch {
      toast.error("Failed to decline invite");
    } finally {
      setRespondingInvite(null);
    }
  };

  const messages = activeView ? activeView.data.messages : [];
  const isAdmin =
    activeView?.type === "group" &&
    activeView.data.groupChat.creatorId === user?.id;

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* Sidebar */}
      <div className="w-72 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">DMs, group chats & invites</p>
        </div>
        <ScrollArea className="flex-1">
          {loadingConvos ? (
            <p className="p-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="p-2 space-y-1">
              {/* Pending Session Invites */}
              {invites.length > 0 && (
                <>
                  <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    Session Invites
                    <Badge className="text-[10px] px-1.5 py-0 h-4">{invites.length}</Badge>
                  </p>
                  {invites.map((invite) => {
                    const busy = respondingInvite === invite.sessionId;
                    return (
                      <div
                        key={invite.sessionId}
                        className="rounded-lg border bg-card p-3 mx-1 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                            <AvatarFallback className="text-xs">
                              {invite.creator.displayName?.charAt(0)?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug truncate">
                              {invite.sessionTitle || "Study Session"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              from {invite.creator.displayName || "Someone"}
                            </p>
                            {invite.sessionStartTime && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(invite.sessionStartTime).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleAcceptInvite(invite)}
                            disabled={busy}
                          >
                            {busy ? "..." : "Accept"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs"
                            onClick={() => handleDeclineInvite(invite)}
                            disabled={busy}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Separator className="my-1" />
                </>
              )}

              {/* Group Chats */}
              {groupChats.length > 0 && (
                <>
                  <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Group Chats
                  </p>
                  {groupChats.map((gc) => {
                    const isActive =
                      activeView?.type === "group" &&
                      activeView.data.groupChat.id === gc.id;
                    return (
                      <button
                        key={gc.id}
                        type="button"
                        onClick={() => openGroupChat(gc.id)}
                        className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback>
                            {gc.name?.charAt(0)?.toUpperCase() || "G"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">
                              {gc.name || gc.sessionTitle || "Group Chat"}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1 py-0 shrink-0 ${isActive ? "border-primary-foreground/40" : ""}`}
                            >
                              {gc.memberCount}
                            </Badge>
                          </div>
                          {gc.lastMessage ? (
                            <p
                              className={`text-xs truncate ${
                                isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                              }`}
                            >
                              {gc.lastMessage.senderName}: {gc.lastMessage.body}
                            </p>
                          ) : (
                            <p className={`text-xs ${isActive ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
                              No messages yet
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Direct Messages */}
              {conversations.length > 0 && (
                <>
                  {groupChats.length > 0 && <Separator className="my-1" />}
                  <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Direct Messages
                  </p>
                  {conversations.map((c) => {
                    const isActive =
                      activeView?.type === "dm" &&
                      activeView.data.conversation.otherUser.id === c.otherUser.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openDM(c.otherUser.id)}
                        className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback>
                            {c.otherUser.displayName?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {c.otherUser.displayName || "Unknown"}
                          </p>
                          {c.lastMessage && (
                            <p
                              className={`text-xs truncate ${
                                isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                              }`}
                            >
                              {c.lastMessage.body}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {conversations.length === 0 && groupChats.length === 0 && invites.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  No conversations yet. Connect with someone on Social or join a study session.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Active chat panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {!activeView ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {loadingChat ? (
              <p>Loading conversation...</p>
            ) : (
              <div className="text-center max-w-sm">
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">
                  Choose a chat from the list, or accept a session invite to open the group chat.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {activeView.type === "dm"
                    ? activeView.data.conversation.otherUser.displayName?.charAt(0)?.toUpperCase() || "?"
                    : activeView.data.groupChat.name?.charAt(0)?.toUpperCase() || "G"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {activeView.type === "dm" ? (
                  <>
                    <p className="font-semibold">
                      {activeView.data.conversation.otherUser.displayName || "Unknown"}
                    </p>
                    {activeView.data.conversation.otherUser.email && (
                      <p className="text-xs text-muted-foreground">
                        {activeView.data.conversation.otherUser.email}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold">
                      {activeView.data.groupChat.name || activeView.data.groupChat.sessionTitle || "Group Chat"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activeView.data.members.length} members
                    </p>
                  </>
                )}
              </div>
              {activeView.type === "group" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMembers(!showMembers)}
                >
                  {showMembers ? "Hide Members" : "Members"}
                </Button>
              )}
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((m) => {
                    const isMe = m.senderId === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          {!isMe && (
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">
                              {m.senderName || "Unknown"}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={`text-xs mt-1 ${
                              isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Members sidebar */}
              {activeView.type === "group" && showMembers && (
                <div className="w-56 border-l bg-muted/20 p-3 overflow-y-auto shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Members
                  </p>
                  <div className="space-y-2">
                    {activeView.data.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {m.displayName?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{m.displayName || "Unknown"}</p>
                          {m.role === "admin" && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              Admin
                            </Badge>
                          )}
                        </div>
                        {isAdmin && m.userId !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(m)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="p-4 border-t shrink-0 flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={sending}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={sending || !messageText.trim()}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
