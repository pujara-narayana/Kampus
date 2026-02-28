"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "📅" },
  { href: "/dashboard/events", label: "Events", icon: "🎉" },
  { href: "/dashboard/sessions", label: "Study Sessions", icon: "📚" },
  { href: "/dashboard/insights", label: "Insights", icon: "📊" },
  { href: "/dashboard/social", label: "Social", icon: "👥" },
  { href: "/dashboard/chat", label: "Chat", icon: "💬" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="text-2xl font-bold text-primary">Kampus</span>
        <span className="text-sm text-muted-foreground">UNL</span>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 truncate">
          <p className="text-sm font-medium truncate">
            {user?.displayName || "Student"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.email}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
    </aside>
  );
}
