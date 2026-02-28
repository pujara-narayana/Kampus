export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  type: "class" | "assignment" | "event" | "study_session" | "free_food";
  color: string;
  meta?: Record<string, unknown>;
}

export interface AssignmentView {
  id: string;
  name: string;
  courseName: string;
  courseCode: string;
  dueAt: string | null;
  pointsPossible: number;
  hasSubmitted: boolean;
  estimatedHours: number | null;
  score: number | null;
  htmlUrl: string | null;
}

export interface EventView {
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
  distance?: number;
  walkMinutes?: number;
}

export interface StudySessionView {
  id: string;
  title: string;
  description: string | null;
  courseName: string | null;
  courseCode: string | null;
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

export interface InsightsData {
  procrastinationIndex: number;
  avgDaysBeforeDue: number;
  totalStudyHours: number;
  studySessionsAttended: number;
  eventsAttended: number;
  freeFoodEvents: number;
  streaks: {
    type: string;
    currentCount: number;
    longestCount: number;
  }[];
  gradeTrends: {
    courseName: string;
    scores: { date: string; score: number }[];
  }[];
  weeklyStudyHours: {
    week: string;
    hours: number;
  }[];
  aiSummary: string | null;
}

export interface UserProfile {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastSyncAt: string | null;
}

export interface FeedItemView {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  userName: string;
  userAvatar: string | null;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  data: Record<string, unknown> | null;
}
