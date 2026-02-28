"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

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
}

interface WeeklyData {
  summary: {
    aiSummary: string | null;
    totalAssignmentsDue: number;
    assignmentsCompleted: number;
    totalStudyHours: number;
  } | null;
}

export default function InsightsPage() {
  const [patterns, setPatterns] = useState<PatternData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, wRes] = await Promise.allSettled([
          api.getPatterns(),
          api.getWeeklyInsights(),
        ]);
        if (pRes.status === "fulfilled") setPatterns(pRes.value as unknown as PatternData);
        if (wRes.status === "fulfilled") setWeekly(wRes.value as unknown as WeeklyData);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          Your academic patterns and behavioral analytics.
        </p>
      </div>

      {/* AI Weekly Summary */}
      {weekly?.summary?.aiSummary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {weekly.summary.aiSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="text-2xl font-bold">
              🍕 {patterns?.freeFoodEvents ?? 0}
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
                        <span className="ml-1">🔥</span>
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
                {patterns.gradeTrends.map((course, i) => (
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
                <span className="font-medium">
                  🍕 {patterns?.freeFoodEvents ?? 0}
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
