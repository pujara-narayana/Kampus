"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type BehaviorProfileResponse } from "@/lib/api-client";
import { Pizza, Flame, TrendingDown, BookOpen, Video } from "lucide-react";
import { BurnoutChart } from "@/components/insights/burnout-chart";
import { RiskMatrix } from "@/components/insights/risk-matrix";

interface PatternData {
  procrastinationIndex: number;
  avgDaysBeforeDue: number;
  totalStudyHours: number;
  studySessionsAttended: number;
  eventsAttended: number;
  freeFoodEvents: number;
  streaks: { type: string; currentCount: number; longestCount: number }[];
  gradeTrends: {
    courseName: string | null;
    courseCode: string | null;
    currentGrade: string | null;
    currentScore: number | null;
    grades: { score: number | null; pointsPossible: number | null; recordedAt: Date }[];
  }[];
  burnoutData?: any[];
  riskMatrixData?: any[];
  distractions?: {
    courseId: string;
    courseName: string;
    title: string;
    message: string;
    impact: number;
    app: string;
  }[];
}

interface WeeklyData {
  summary: {
    aiSummary: string | null;
    totalAssignmentsDue: number;
    assignmentsCompleted: number;
    totalStudyHours: number;
  } | null;
}

const GRADES_COLLAPSED_LIMIT = 5;

const PROFILE_META: Record<string, { label: string; icon: string; color: string }> = {
  early_planner: { label: "Early Planner", icon: "📅", color: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300" },
  deadline_sprinter: { label: "Deadline Sprinter", icon: "⚡", color: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300" },
  social_learner: { label: "Social Learner", icon: "👥", color: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300" },
  solo_grinder: { label: "Solo Grinder", icon: "🎯", color: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300" },
  balanced_achiever: { label: "Balanced Achiever", icon: "⚖️", color: "bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300" },
};

const ALERT_COLORS: Record<string, string> = {
  info: "border-blue-500/40 bg-blue-500/5",
  warning: "border-yellow-500/40 bg-yellow-500/5",
  critical: "border-red-500/40 bg-red-500/5",
};

const ALERT_BADGE: Record<string, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warning: "outline",
  critical: "destructive",
};

const REC_TYPE_ICON: Record<string, string> = {
  study_session: "📚",
  campus_event: "🎉",
  create_solo_session: "✍️",
  review_course: "📖",
};

export default function InsightsPage() {
  const [patterns, setPatterns] = useState<PatternData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [behaviorProfile, setBehaviorProfile] = useState<BehaviorProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradesExpanded, setGradesExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, wRes, bRes] = await Promise.allSettled([
          api.getPatterns(),
          api.getWeeklyInsights(),
          api.getBehaviorProfile(),
        ]);
        if (pRes.status === "fulfilled") setPatterns(pRes.value as unknown as PatternData);
        if (wRes.status === "fulfilled") setWeekly(wRes.value as unknown as WeeklyData);
        if (bRes.status === "fulfilled") setBehaviorProfile(bRes.value as BehaviorProfileResponse);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading insights...</p>
      </div>
    );
  }

  const procIndex = patterns?.procrastinationIndex ?? 0;
  const procLabel =
    procIndex < 0.3
      ? "Early Bird"
      : procIndex < 0.6
        ? "On Track"
        : procIndex < 0.8
          ? "Procrastinator"
          : "Last Minute Larry";

  const profileMeta = behaviorProfile
    ? (PROFILE_META[behaviorProfile.profile] ?? { label: behaviorProfile.profile, icon: "🧠", color: "bg-muted border-border" })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          Your academic patterns and behavioral analytics.
        </p>
      </div>

      {/* Behavioral Profile Card */}
      {behaviorProfile && profileMeta && (
        <Card className={`border ${profileMeta.color}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{profileMeta.icon}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Learning Profile
                </p>
                <CardTitle className="text-xl">
                  {profileMeta.label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {(behaviorProfile.confidence * 100).toFixed(0)}% confidence
                  </span>
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium text-sm">{behaviorProfile.coaching.headline}</p>
            <p className="text-sm text-muted-foreground">{behaviorProfile.coaching.tip}</p>
            <p className="text-sm">{behaviorProfile.coaching.motivation}</p>
          </CardContent>
        </Card>
      )}

      {/* Academic Alerts */}
      {behaviorProfile && behaviorProfile.alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Academic Alerts
          </h2>
          {behaviorProfile.alerts.map((alert, i) => (
            <Card key={i} className={`border ${ALERT_COLORS[alert.severity] ?? ""}`}>
              <CardContent className="py-3 flex items-start gap-3">
                <span className="text-lg mt-0.5">
                  {alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={ALERT_BADGE[alert.severity] ?? "secondary"} className="text-xs">
                      {alert.severity}
                    </Badge>
                    {alert.courseName && (
                      <span className="text-xs text-muted-foreground">{alert.courseName}</span>
                    )}
                  </div>
                  <p className="text-sm mt-1">{alert.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Smart Recommendations */}
      {behaviorProfile && behaviorProfile.recommendations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Smart Recommendations
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {behaviorProfile.recommendations.slice(0, 6).map((rec) => (
              <Card key={rec.id} className="border">
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{REC_TYPE_ICON[rec.type] ?? "💡"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-2">{rec.title}</p>
                      {rec.startTime && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(rec.startTime).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{rec.reason}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {(rec.engagementProbability * 100).toFixed(0)}% match
                    </Badge>
                    {rec.academicUplift > 0 && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/40">
                        +{(rec.academicUplift * 100).toFixed(0)}% uplift
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Weekly Summary */}
      {weekly?.summary?.aiSummary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Weekly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {weekly.summary.aiSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Predictive Visualizations */}
      <div className="grid gap-6 md:grid-cols-2">
        <BurnoutChart data={patterns?.burnoutData || []} />
        <RiskMatrix data={patterns?.riskMatrixData || []} />
      </div>

      {/* Simulated Distraction Telemetry */}
      {patterns?.distractions && patterns.distractions.length > 0 && (
        <div className="mt-6 mb-6">
          {patterns.distractions.map((d, i) => (
            <Card key={i} className="border-red-500/40 bg-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Video className="w-5 h-5" />
                  {d.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium leading-relaxed dark:text-red-200/80">
                  {d.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Procrastination Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(procIndex * 100).toFixed(0)}%
            </div>
            <Badge
              variant={procIndex < 0.5 ? "secondary" : "destructive"}
              className="mt-1"
            >
              {procLabel}
            </Badge>
            <Progress value={procIndex * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Days Before Deadline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patterns?.avgDaysBeforeDue?.toFixed(1) ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              days before assignments due
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Study Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patterns?.totalStudyHours?.toFixed(1) ?? "0"}h
            </div>
            <p className="text-xs text-muted-foreground">this semester</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Free Food Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Pizza className="w-6 h-6 text-[#D00000]" /> {patterns?.freeFoodEvents ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              events attended this semester
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Streaks */}
        <Card>
          <CardHeader>
            <CardTitle>Streaks</CardTitle>
          </CardHeader>
          <CardContent>
            {!patterns?.streaks?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Start studying to build your first streak!
              </p>
            ) : (
              <div className="space-y-3">
                {patterns.streaks.map((streak, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {streak.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Best: {streak.longestCount} days
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">
                        {streak.currentCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        days
                      </span>
                      {streak.currentCount >= 3 && (
                        <Flame className="w-4 h-4 inline-block ml-1 text-orange-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Course Grades</CardTitle>
          </CardHeader>
          <CardContent>
            {!patterns?.gradeTrends?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No grade data yet. Sync your Canvas data via the extension.
              </p>
            ) : (
              <div className="space-y-3">
                {(gradesExpanded
                  ? patterns.gradeTrends
                  : patterns.gradeTrends.slice(0, GRADES_COLLAPSED_LIMIT)
                ).map((course, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <p className="font-medium text-sm">
                      {course.courseName || course.courseCode || "Course"}
                    </p>
                    <div className="flex items-center gap-2">
                      {course.currentScore != null && (
                        <>
                          <Progress
                            value={course.currentScore}
                            className="w-20"
                          />
                          <span className="text-sm font-medium w-12 text-right">
                            {course.currentScore.toFixed(1)}%
                          </span>
                        </>
                      )}
                      {course.currentGrade != null && (
                        <Badge variant="secondary">{course.currentGrade}</Badge>
                      )}
                      {course.currentGrade == null &&
                        course.currentScore == null && (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                    </div>
                  </div>
                ))}
                {patterns.gradeTrends.length > GRADES_COLLAPSED_LIMIT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setGradesExpanded((e) => !e)}
                  >
                    {gradesExpanded
                      ? "Show less"
                      : `Show more (${patterns.gradeTrends.length - GRADES_COLLAPSED_LIMIT} more)`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Study Sessions Attended</span>
                <span className="font-medium">
                  {patterns?.studySessionsAttended ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Events Attended</span>
                <span className="font-medium">
                  {patterns?.eventsAttended ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Free Food Events</span>
                <span className="font-medium flex items-center gap-2">
                  <Pizza className="w-4 h-4 text-[#D00000]" /> {patterns?.freeFoodEvents ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Stats */}
        {weekly?.summary && (
          <Card>
            <CardHeader>
              <CardTitle>This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Assignments Due</span>
                  <span className="font-medium">
                    {weekly.summary.totalAssignmentsDue}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="font-medium">
                    {weekly.summary.assignmentsCompleted}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Study Hours</span>
                  <span className="font-medium">
                    {weekly.summary.totalStudyHours ?? 0}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
