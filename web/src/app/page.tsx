import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  Bot,
  Users,
  Sparkles,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

// Unsplash stock images (free to use, high quality)
const IMAGES = {
  calendar:
    "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&q=80",
  studyGroup:
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80",
  campusEvents:
    "https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80",
} as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/80" />
      <div className="pointer-events-none fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE4YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D00000] text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Kampus
          </span>
          <span className="rounded-full border border-[#D00000]/40 bg-[#D00000]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D00000]">
            UNL
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white hover:bg-white/5"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[#D00000] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b00000]"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-12 pb-20 text-center sm:px-8 sm:pt-20 sm:pb-28">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider text-amber-400/90">
            <Sparkles className="h-3.5 w-3.5" />
            Built for RaikesHacks 2026
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl md:text-6xl">
            Your campus life,{" "}
            <span className="bg-gradient-to-r from-[#D00000] to-[#ff4444] bg-clip-text text-transparent">
              unified.
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Join UNL students using Kampus to stay on top of classes, assignments,
            and study sessions — all in one place.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D00000] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#D00000]/20 transition-all hover:bg-[#b00000] hover:shadow-[#D00000]/30 sm:w-auto"
            >
              Get Started — It&apos;s Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-600 bg-zinc-800/50 px-8 py-4 text-base font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700/50 hover:text-white sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Section 1: Calendar */}
      <section className="relative z-10 border-t border-zinc-800/80 bg-zinc-900/30 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
              <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 sm:h-72 sm:max-w-md">
                <Image
                  src={IMAGES.calendar}
                  alt="Calendar and planner on a desk"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 448px"
                  priority
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
                Calendar
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
                One place for classes, assignments & events
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-400">
                Your MyRed schedule, Canvas assignments, study sessions, and
                campus events in a single calendar. Sync to Google Calendar with one click.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D00000] transition-colors hover:text-[#ff4444]"
              >
                See your calendar
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Study sessions */}
      <section className="relative z-10 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="inline-block rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Study sessions
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Find study buddies in your courses
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-400">
                Create or join study sessions, invite friends, and keep everything
                in sync. See who else is studying for the same class and meet up on campus.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D00000] transition-colors hover:text-[#ff4444]"
              >
                Join a session
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 sm:h-72 sm:max-w-md">
                <Image
                  src={IMAGES.studyGroup}
                  alt="Students studying together"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 448px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Free food (last) */}
      <section className="relative z-10 border-t border-zinc-800/80 bg-zinc-900/30 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
              <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 sm:h-72 sm:max-w-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={IMAGES.campusEvents}
                  alt="Campus and university life"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="inline-block rounded-lg bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400">
                Events
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Campus events & free food alerts
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-400">
                See what&apos;s happening on campus. We also highlight events with free food
                so you never miss a slice.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D00000] transition-colors hover:text-[#ff4444]"
              >
                Browse events
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: How it works / Extension */}
      <section className="relative z-10 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center sm:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-zinc-400">
            The Kampus Chrome extension syncs your data from Canvas, MyRed, and NvolveU — no manual entry.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Install the extension",
                desc: "Add the Kampus extension to Chrome and sign in with your UNL account.",
                icon: GraduationCap,
              },
              {
                step: "2",
                title: "We sync your data",
                desc: "Classes, assignments, grades, and campus events flow into your dashboard.",
                icon: Bot,
              },
              {
                step: "3",
                title: "Use your dashboard",
                desc: "One place for calendar, events, study sessions, and free food alerts.",
                icon: CalendarDays,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div
                key={step}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-left transition-colors hover:border-zinc-700"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D00000]/20 text-sm font-bold text-[#D00000]">
                  {step}
                </span>
                <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-[#D00000]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-zinc-800/80 bg-zinc-900/30 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-6 text-center sm:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to unify your campus life?
          </h2>
          <p className="mt-3 text-zinc-400">
            Join UNL students on Kampus. Free to use.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D00000] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#b00000] sm:w-auto"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-600 px-8 py-4 text-base font-medium text-zinc-200 transition-colors hover:bg-zinc-800 sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-zinc-800/80 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D00000] text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-semibold text-white">Kampus</span>
            <span className="text-xs text-zinc-500">UNL</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-zinc-400 transition-colors hover:text-white">
              Sign In
            </Link>
            <Link href="/register" className="text-zinc-400 transition-colors hover:text-white">
              Get Started
            </Link>
          </div>
        </div>
        <div className="mt-6 border-t border-zinc-800/80 pt-6 text-center">
          <p className="text-sm text-zinc-500">
            University of Nebraska-Lincoln · RaikesHacks 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
