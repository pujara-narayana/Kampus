"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Home,
  Calendar,
  PartyPopper,
  Library,
  BarChart,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  GraduationCap,
  UtensilsCrossed,
  DollarSign,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", Icon: Home },
    { href: "/dashboard/calendar", label: "Calendar", Icon: Calendar },
    { href: "/dashboard/events", label: "Events", Icon: PartyPopper },
    { href: "/dashboard/sessions", label: "Study Sessions", Icon: Library },
    { href: "/dashboard/insights", label: "Insights", Icon: BarChart },
    { href: "/dashboard/social", label: "Social", Icon: Users },
    { href: "/dashboard/chat", label: "Chat", Icon: MessageSquare },
    { href: "/dashboard/settings", label: "Settings", Icon: Settings },
  ];

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-card shadow-sm">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <span className="truncate text-lg font-semibold tracking-tight text-foreground">
            Kampus
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            UNL
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Dining balance - dummy data for presentation */}
      <div className="px-3 py-3">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            Dining
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Meal swipes</span>
              <span className="font-semibold text-foreground">12 this week</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dining dollars</span>
              <span className="font-semibold text-foreground flex items-center gap-0.5">
                <DollarSign className="h-3.5 w-3.5" />
                247.50
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-9 w-9 shrink-0 border-2 border-background shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {user?.displayName || "Student"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Log out</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
