"use client";

import { AuthProvider } from "@/lib/auth-context";
import { GraduationCap, Pizza } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzem0wLTI0YzEuNjU2IDAgMy0xLjM0NCAzLTNzLTEuMzQ0LTMtMy0zLTMgMS4zNDQtMyAzIDEuMzQ0IDMgMyAzeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative z-10 w-full max-w-md px-4">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D00000]/20 shadow-lg ring-1 ring-[#D00000]/30">
              <GraduationCap className="h-8 w-8 text-[#D00000]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Kampus
            </h1>
            <span className="mt-1.5 inline-block rounded-full border border-[#D00000]/30 bg-[#D00000]/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#D00000]">
              UNL
            </span>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-400">
              Your campus life, unified.
              <Pizza className="h-4 w-4 text-[#D00000]" />
            </p>
          </div>
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
