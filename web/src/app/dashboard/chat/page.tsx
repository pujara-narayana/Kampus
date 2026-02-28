"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type ChatConversation, type ChatMessage, type ChatWithUserResponse } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const POLL_INTERVAL_MS = 5000;

export default function ChatPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeConversation, setActiveConversation] = useState<ChatWithUserResponse | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.getChatConversations();
      setConversations(res.conversations || []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  const openChat = useCallback(
    async (otherUserId: string) => {
      if (!otherUserId || otherUserId === user?.id) return;
      setLoadingChat(true);
      try {
        const res = await api.getChatWithUser(otherUserId);
        setActiveConversation(res);
        await loadConversations(); // refresh list so new conversation appears
      } catch {
        setActiveConversation(null);
      } finally {
        setLoadingChat(false);
      }
    },
    [user?.id, loadConversations]
  );

  // Open chat from ?with=userId
  useEffect(() => {
    if (withUserId && user?.id && withUserId !== user.id) {
      openChat(withUserId);
    }
  }, [withUserId, user?.id, openChat]);

  // Load conversation list on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Poll for new messages when a conversation is open
  useEffect(() => {
    if (!activeConversation?.conversation?.otherUser?.id) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const otherId = activeConversation.conversation.otherUser.id;
    const poll = async () => {
      try {
        const res = await api.getChatWithUser(otherId);
        setActiveConversation((prev) =>
          prev ? { ...res, conversation: prev.conversation } : res
        );
      } catch {
        // keep current state
      }
    };
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConversation?.conversation?.otherUser?.id]);

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !activeConversation?.conversation?.id || sending) return;
    setSending(true);
    try {
      const { message } = await api.sendChatMessage(activeConversation.conversation.id, text);
      setActiveConversation((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, message],
            }
          : prev
      );
      setMessageText("");
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      // could toast error
    } finally {
      setSending(false);
    }
  };

  const otherUser = activeConversation?.conversation?.otherUser;
  const messages = activeConversation?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* Conversation list */}
      <div className="w-72 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chat with your connections
          </p>
        </div>
        <ScrollArea className="flex-1">
          {loadingConvos ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet. Connect with someone on Social, then start a chat here.
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((c) => {
                const isActive =
                  activeConversation?.conversation?.otherUser?.id === c.otherUser.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openChat(c.otherUser.id)}
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
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Active chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {!otherUser ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {loadingChat ? (
              <p>Loading conversation…</p>
            ) : (
              <div className="text-center max-w-sm">
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">
                  Choose someone from the list or open a chat from the Social page.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {otherUser.displayName?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{otherUser.displayName || "Unknown"}</p>
                {otherUser.email && (
                  <p className="text-xs text-muted-foreground">{otherUser.email}</p>
                )}
              </div>
            </div>

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
                          isMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
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

            <div className="p-4 border-t shrink-0 flex gap-2">
              <Input
                placeholder="Type a message…"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={sending}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={sending || !messageText.trim()}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
