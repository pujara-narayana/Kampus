const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface ChatConversation {
  id: string;
  otherUser: { id: string; displayName: string | null; avatarUrl: string | null; email: string | null };
  lastMessage: { id: string; body: string; senderId: string; createdAt: string } | null;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
  senderName: string | null;
  createdAt: string;
}

export interface ChatWithUserResponse {
  conversation: { id: string; otherUser: { id: string; displayName: string | null; avatarUrl: string | null; email: string | null } };
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("kampus_token");
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; displayName: string }) =>
    fetchAPI<{ token: string; user: Record<string, unknown> }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    fetchAPI<{ token: string; user: Record<string, unknown> }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Calendar
  getCalendar: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString();
    return fetchAPI<{
      classes: Record<string, unknown>[];
      assignments: Record<string, unknown>[];
      events: Record<string, unknown>[];
      studySessions: Record<string, unknown>[];
      googleEvents?: { id: string; title: string; start: string; end?: string; htmlLink?: string }[];
      googleConnected?: boolean;
    }>(`/api/calendar${q ? `?${q}` : ""}`);
  },
  // Google Calendar OAuth — returns URL to redirect user to connect their calendar
  getGcalAuthUrl: () =>
    fetchAPI<{ redirectUrl: string }>("/api/gcal/auth"),

  // Assignments
  getUpcomingAssignments: () =>
    fetchAPI<{ assignments: Record<string, unknown>[] }>("/api/assignments/upcoming"),

  // Events
  getEvents: (freeFood?: boolean) =>
    fetchAPI<{ events: Record<string, unknown>[] }>(
      `/api/events${freeFood ? "?free_food=true" : ""}`
    ),
  getNearbyEvents: (lat: number, lng: number) =>
    fetchAPI<{ events: Record<string, unknown>[] }>(
      `/api/events/nearby?lat=${lat}&lng=${lng}`
    ),

  // Sessions
  getSessions: () =>
    fetchAPI<{ sessions: Record<string, unknown>[] }>("/api/sessions"),
  getSession: (id: string) =>
    fetchAPI<{ session: Record<string, unknown> }>(`/api/sessions/${id}`),
  createSession: (data: Record<string, unknown>) =>
    fetchAPI<{ session: Record<string, unknown> }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  joinSession: (id: string) =>
    fetchAPI<{ participant: Record<string, unknown> }>(`/api/sessions/${id}/join`, {
      method: "POST",
    }),
  inviteToSession: (sessionId: string, userIds: string[]) =>
    fetchAPI<{ invited: number; skipped: number; message: string }>(
      `/api/sessions/${sessionId}/invite`,
      { method: "POST", body: JSON.stringify({ userIds }) }
    ),

  // Social
  getFeed: () => fetchAPI<{ items: Record<string, unknown>[] }>("/api/social/feed"),
  getConnections: () =>
    fetchAPI<{ connections: Record<string, unknown>[] }>("/api/social/connect"),
  sendConnectionRequest: (receiverId: string) =>
    fetchAPI<{ connection: Record<string, unknown> }>("/api/social/connect", {
      method: "POST",
      body: JSON.stringify({ receiverId }),
    }),
  updateConnection: (connectionId: string, action: "accept" | "decline") =>
    fetchAPI<{ connection?: Record<string, unknown>; message: string }>(
      `/api/social/connect/${connectionId}`,
      {
        method: "PUT",
        body: JSON.stringify({ action }),
      }
    ),
  getPeople: () =>
    fetchAPI<{ people: Record<string, unknown>[]; total: number }>("/api/social/people"),
  getSameBoat: (courseId: string) =>
    fetchAPI<{ users: Record<string, unknown>[] }>(`/api/social/same-boat?courseId=${courseId}`),

  // Chat (connections)
  getChatConversations: () =>
    fetchAPI<{ conversations: ChatConversation[] }>("/api/chat/conversations"),
  getChatWithUser: (userId: string, limit?: number, before?: string) => {
    const params = new URLSearchParams();
    if (limit != null) params.set("limit", String(limit));
    if (before) params.set("before", before);
    const q = params.toString();
    return fetchAPI<ChatWithUserResponse>(`/api/chat/with/${userId}${q ? `?${q}` : ""}`);
  },
  sendChatMessage: (conversationId: string, text: string) =>
    fetchAPI<{ message: ChatMessage }>("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId, text }),
    }),

  // Insights
  getWeeklyInsights: () => fetchAPI<Record<string, unknown>>("/api/insights/weekly"),
  getPatterns: () => fetchAPI<Record<string, unknown>>("/api/insights/patterns"),

  // Notifications
  getNotifications: () =>
    fetchAPI<{ notifications: Record<string, unknown>[] }>("/api/notifications"),
  markNotificationRead: (ids: string[]) =>
    fetchAPI<Record<string, unknown>>("/api/notifications", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),

  // Settings
  getSettings: () =>
    fetchAPI<{ sessionVisibility: "all" | "friends" }>("/api/settings"),
  updateSettings: (data: { sessionVisibility?: "all" | "friends" }) =>
    fetchAPI<{ sessionVisibility: "all" | "friends" }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Seed
  seed: () => fetchAPI<Record<string, unknown>>("/api/seed", { method: "POST" }),
};
