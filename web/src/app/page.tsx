import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Subtle grid pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzem0wLTI0YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight">Kampus</span>
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
            UNL
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-blue-200/70 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1.5 text-sm text-orange-300">
          <span>🍕</span>
          <span>Never miss free food again</span>
        </div>

        <h1 className="max-w-3xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl md:text-7xl">
          Your campus life,{" "}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            unified
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-blue-100/60 sm:text-xl">
          Smart calendar • AI study planner • Free food alerts • Study sessions
          • Campus events — all powered by the data your Chrome extension
          silently syncs from Canvas, MyRed, and NvolveU.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/30"
          >
            Get Started — It&apos;s Free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-medium text-blue-200 backdrop-blur-sm transition-all hover:bg-white/10"
          >
            Sign In
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "📅", title: "Smart Calendar", desc: "Classes, assignments, events in one view" },
            { icon: "🤖", title: "AI Study Planner", desc: "Auto-estimate time for assignments" },
            { icon: "🍕", title: "Free Food Alerts", desc: "AI-detected free food on campus" },
            { icon: "📚", title: "Study Sessions", desc: "Find peers in the same courses" },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/5 bg-white/5 p-5 text-left backdrop-blur-sm transition-colors hover:border-white/10 hover:bg-white/[0.07]"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-3 font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-blue-200/50">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-sm text-blue-200/30">
        Built for RaikesHacks 2026 — University of Nebraska-Lincoln
      </footer>
    </div>
  );
}
