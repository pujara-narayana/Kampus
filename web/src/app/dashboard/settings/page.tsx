"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

type ThemeValue = "light" | "dark" | "system";
type SessionVisibility = "all" | "friends";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sessionVisibility, setSessionVisibility] = useState<SessionVisibility>("all");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api
      .getSettings()
      .then((res) => setSessionVisibility(res.sessionVisibility ?? "all"))
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  async function handleSessionVisibilityChange(value: SessionVisibility) {
    setSavingVisibility(true);
    try {
      await api.updateSettings({ sessionVisibility: value });
      setSessionVisibility(value);
      toast.success("Study session preference saved.");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Customize your Kampus experience.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how Kampus looks. You can pick a theme or use your system preference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={mounted ? ((theme as ThemeValue) || "system") : "system"}
              onValueChange={(v) => setTheme(v as ThemeValue)}
              disabled={!mounted}
            >
              <SelectTrigger id="theme" className="w-[180px]">
                <SelectValue placeholder={mounted ? "Select theme" : "Loading..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mounted && resolvedTheme
                ? `Currently using ${resolvedTheme} mode.`
                : "Theme follows your device setting when set to System."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study Sessions</CardTitle>
          <CardDescription>
            Choose which study sessions appear on the Study Sessions page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionVisibility">Session visibility</Label>
            <Select
              value={settingsLoading ? "all" : sessionVisibility}
              onValueChange={(v) => handleSessionVisibilityChange(v as SessionVisibility)}
              disabled={settingsLoading || savingVisibility}
            >
              <SelectTrigger id="sessionVisibility" className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone&apos;s public sessions</SelectItem>
                <SelectItem value="friends">Friends only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {sessionVisibility === "all"
                ? "You see all public study sessions and can join any of them."
                : "You only see sessions created by you or your friends."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>
            Calendar and schedule preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Week starts on</Label>
            <Select defaultValue="sunday" disabled>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Coming soon.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose what you want to be notified about.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notification preferences (assignment reminders, free food alerts, session invites) will be available here soon.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your profile and connected services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-sm">Google Calendar</p>
              <p className="text-xs text-muted-foreground">
                Connect your calendar in the Calendar page to sync events.
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-sm">Canvas / Extension</p>
              <p className="text-xs text-muted-foreground">
                Use the Kampus extension to sync assignments and schedule.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
