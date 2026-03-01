import Link from "next/link";
import { Pizza, CalendarDays, Bot, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* 60% Dominant Background with very subtle pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzem0wLTI0YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          {/* Logo in white (Dominant contrast) */}
          <span className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">Kampus</span>
          {/* 10% Accent Badge */}
          <span className="rounded-full bg-[#D00000]/20 px-2 py-0.5 text-xs font-bold text-[#D00000] uppercase tracking-widest border border-[#D00000]/30 shadow-sm shadow-[#D00000]/10">
            UNL
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* 30% Secondary Nav Item */}
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white hover:bg-zinc-800"
          >
            Sign In
          </Link>
          {/* 10% Accent CTA */}
          <Link
            href="/register"
            className="rounded-lg bg-[#D00000] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#b00000] shadow-md shadow-[#D00000]/20"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* 30% Secondary Pill with 10% Accent text */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-5 py-2 text-sm font-medium text-zinc-300 backdrop-blur-sm">
          <Pizza className="w-5 h-5 text-[#D00000]" />
          <span>Never miss <span className="text-[#D00000] font-bold">free food</span> again</span>
        </div>

        {/* 60% Dominant typography */}
        <h1 className="max-w-4xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl md:text-7xl text-white">
          Your campus life,{" "}
          {/* 10% Accent highlight */}
          <span className="text-[#D00000]">
            unified.
          </span>
        </h1>

        {/* 30% Secondary text */}
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl font-medium">
          Smart calendar • AI study planner • Free food alerts • Study sessions
          • Campus events — all powered by the data your Chrome extension
          silently syncs from Canvas, MyRed, and NvolveU.
        </p>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row w-full max-w-md sm:max-w-none items-center justify-center">
          {/* 10% Accent Primary Button */}
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#D00000] px-10 py-4 text-lg font-bold text-white shadow-xl shadow-[#D00000]/25 transition-all hover:bg-[#b00000] hover:shadow-[#D00000]/40 hover:-translate-y-0.5"
          >
            Get Started — It&apos;s Free
          </Link>
          {/* 30% Secondary Button */}
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/50 px-10 py-4 text-lg font-bold text-zinc-200 backdrop-blur-md transition-all hover:bg-zinc-700 hover:text-white"
          >
            Sign In
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <CalendarDays className="w-6 h-6 text-[#D00000]" />, title: "Smart Calendar", desc: "Classes, assignments, events in one view" },
            { icon: <Bot className="w-6 h-6 text-[#D00000]" />, title: "AI Study Planner", desc: "Auto-estimate time for assignments" },
            { icon: <Pizza className="w-6 h-6 text-[#D00000]" />, title: "Free Food Alerts", desc: "AI-detected free food on campus" },
            { icon: <Users className="w-6 h-6 text-[#D00000]" />, title: "Study Sessions", desc: "Find peers in the same courses" },
          ].map((f) => (
            /* 30% Secondary Card */
            <div
              key={f.title}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left backdrop-blur-md transition-all hover:border-[#D00000]/40 hover:bg-zinc-800 hover:shadow-lg hover:shadow-[#D00000]/10"
            >
              {/* 10% Accent Icon container on hover */}
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-2xl border border-zinc-700 group-hover:bg-[#D00000]/10 group-hover:border-[#D00000]/30 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400 group-hover:text-zinc-300 transition-colors">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer (30% Secondary) */}
      <footer className="relative z-10 py-10 mt-12 border-t border-zinc-900 text-center text-sm font-medium text-zinc-600">
        Built for RaikesHacks 2026 — University of Nebraska-Lincoln
      </footer>
    </div>
  );
}
