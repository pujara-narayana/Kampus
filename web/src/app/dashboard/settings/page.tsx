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
import { Key, RefreshCw, PartyPopper, Calendar } from "lucide-react";

type ThemeValue = "light" | "dark" | "system";
type SessionVisibility = "all" | "friends";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sessionVisibility, setSessionVisibility] = useState<SessionVisibility>("all");
  const [hideFreeFoodAlerts, setHideFreeFoodAlerts] = useState(false);
  const [savingFreeFoodPref, setSavingFreeFoodPref] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [canvasToken, setCanvasToken] = useState("");
  const [savingCanvas, setSavingCanvas] = useState(false);
  const [syncingCanvas, setSyncingCanvas] = useState(false);
  const [syncingNvolveu, setSyncingNvolveu] = useState(false);
  const [syncingMyred, setSyncingMyred] = useState(false);

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

  async function handleMyredSync() {
    setSyncingMyred(true);
    try {
      // Send command to extension via content script bridge
      window.postMessage({ type: 'KAMPUS_COMMAND', command: 'TRIGGER_MYRED_SYNC' }, '*');
      toast.success("MyRed sync started! A background tab will open to scrape your schedule.");
      // Wait a bit then reset
      setTimeout(() => setSyncingMyred(false), 5000);
    } catch {
      toast.error("Make sure the Kampus extension is installed.");
      setSyncingMyred(false);
    }
  }

  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api
      .getSettings()
      .then((res) => {
        setSessionVisibility(res.sessionVisibility ?? "all");
        setHideFreeFoodAlerts(res.hideFreeFoodAlerts ?? false);
      })
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

  async function handleHideFreeFoodAlertsChange(checked: boolean) {
    setSavingFreeFoodPref(true);
    try {
      await api.updateSettings({ hideFreeFoodAlerts: checked });
      setHideFreeFoodAlerts(checked);
      toast.success(checked ? "Free food alerts hidden." : "Free food alerts enabled.");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSavingFreeFoodPref(false);
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
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="hideFreeFoodAlerts">Hide free food alerts</Label>
              <p className="text-xs text-muted-foreground">
                When on, the free food alert banner will not appear on the Dashboard or Events page.
              </p>
            </div>
            <input
              id="hideFreeFoodAlerts"
              type="checkbox"
              checked={hideFreeFoodAlerts}
              disabled={savingFreeFoodPref}
              onChange={(e) => handleHideFreeFoodAlertsChange(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Assignment reminders and session invites will be available here soon.
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
          <div className="space-y-3">
            <p className="text-sm font-medium">Step 1: Generate a token</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => window.open("https://canvas.unl.edu/profile/settings#access_tokens_holder", "_blank")}
            >
              <Key className="w-4 h-4" /> Open Canvas Settings → Generate Token
            </Button>
            <p className="text-xs text-muted-foreground">
              Click &quot;+ New Access Token&quot;, give it any name (e.g. &quot;Kampus&quot;), then copy the token shown.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Step 2: Paste it here</p>
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
          </div>
          <div className="border-t pt-3 mt-3" />
          <div className="flex gap-2">
            <Button
              onClick={handleCanvasSync}
              disabled={syncingCanvas}
              variant="outline"
              size="sm"
              className="flex flex-1 items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncingCanvas ? "animate-spin" : ""}`} /> {syncingCanvas ? "Syncing Canvas..." : "Sync Canvas Now"}
            </Button>
            <Button
              onClick={handleNvolveuSync}
              disabled={syncingNvolveu}
              variant="outline"
              size="sm"
              className="flex flex-1 items-center justify-center gap-2"
            >
              <PartyPopper className="w-4 h-4" /> {syncingNvolveu ? "Syncing Events..." : "Sync Campus Events"}
            </Button>
            <Button
              onClick={handleMyredSync}
              disabled={syncingMyred}
              variant="outline"
              size="sm"
              className="flex flex-1 items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" /> {syncingMyred ? "Opening MyRed..." : "Sync MyRed Schedule"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Canvas sync pulls courses, assignments, and grades. Events sync fetches UNL campus events. MyRed sync opens your schedule page via the extension (requires extension + UNL login).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
