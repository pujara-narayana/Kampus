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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

type ThemeValue = "light" | "dark" | "system";
type SessionVisibility = "all" | "friends";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sessionVisibility, setSessionVisibility] = useState<SessionVisibility>("all");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [canvasToken, setCanvasToken] = useState("");
  const [savingCanvas, setSavingCanvas] = useState(false);
  const [syncingCanvas, setSyncingCanvas] = useState(false);
  const [syncingNvolveu, setSyncingNvolveu] = useState(false);

  async function handleSaveCanvasToken() {
    if (!canvasToken.trim()) return;
    setSavingCanvas(true);
    try {
      await api.saveCanvasToken(canvasToken.trim());
      toast.success("Canvas token saved and validated!");
      setCanvasToken("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save Canvas token");
    } finally {
      setSavingCanvas(false);
    }
  }

  async function handleCanvasSync() {
    setSyncingCanvas(true);
    try {
      const res = await api.syncCanvas();
      const synced = (res as any).synced;
      toast.success(`Synced ${synced?.courses || 0} courses, ${synced?.assignments || 0} assignments, ${synced?.grades || 0} grades`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Canvas sync failed");
    } finally {
      setSyncingCanvas(false);
    }
  }

  async function handleNvolveuSync() {
    setSyncingNvolveu(true);
    try {
      const res = await api.syncNvolveu();
      const synced = (res as any).synced;
      toast.success(`Synced ${synced?.events || 0} campus events`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "NvolveU sync failed");
    } finally {
      setSyncingNvolveu(false);
    }
  }

  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api
      .getSettings()
      .then((res) => setSessionVisibility(res.sessionVisibility ?? "all"))
      .catch(() => { })
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
          <CardTitle>Canvas Integration</CardTitle>
          <CardDescription>
            Connect your Canvas account to sync courses, assignments, and grades without the extension.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="canvasToken">Canvas Access Token</Label>
            <div className="flex gap-2">
              <Input
                id="canvasToken"
                type="password"
                placeholder="Paste your Canvas token here"
                value={canvasToken}
                onChange={(e) => setCanvasToken(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSaveCanvasToken}
                disabled={savingCanvas || !canvasToken.trim()}
                size="sm"
              >
                {savingCanvas ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate a token at{" "}
              <a
                href="https://canvas.unl.edu/profile/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500"
              >
                canvas.unl.edu/profile/settings
              </a>
              {" "}→ New Access Token.
            </p>
          </div>
          <div className="border-t pt-3 mt-3" />
          <div className="flex gap-2">
            <Button
              onClick={handleCanvasSync}
              disabled={syncingCanvas}
              variant="outline"
              size="sm"
            >
              {syncingCanvas ? "Syncing Canvas..." : "🔄 Sync Canvas Now"}
            </Button>
            <Button
              onClick={handleNvolveuSync}
              disabled={syncingNvolveu}
              variant="outline"
              size="sm"
            >
              {syncingNvolveu ? "Syncing Events..." : "🎉 Sync Campus Events"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Canvas sync pulls all courses, assignments, and grades. Events sync fetches UNL campus events (no token needed).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
