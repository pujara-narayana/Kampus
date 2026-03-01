"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Landmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [connectingMyred, setConnectingMyred] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();

    const casError = searchParams.get("error");

    // Listen for extension auto-registration from MyRed
    useEffect(() => {
        function handleExtAuth(event: MessageEvent) {
            if (event.data?.type === 'KAMPUS_EXT_AUTHENTICATED' && event.data.token) {
                // Extension registered the user — store token and redirect
                localStorage.setItem("kampus_token", event.data.token);
                if (event.data.user) {
                    localStorage.setItem("kampus_user", event.data.user);
                }
                router.push("/dashboard");
            }
        }
        window.addEventListener('message', handleExtAuth);
        return () => window.removeEventListener('message', handleExtAuth);
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(email, password);
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-white">
                    Welcome back
                </CardTitle>
                <CardDescription className="text-slate-400">
                    Sign in to your Kampus account
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {(error || casError) && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error || (casError === "cas_invalid"
                                ? "UNL login validation failed. Please try again."
                                : casError === "cas_error"
                                    ? "Something went wrong with UNL login. Please try again."
                                    : "Login error. Please try again.")}
                        </div>
                    )}

                    {/* UNL CAS SSO Login */}
                    <Button
                        type="button"
                        className="w-full bg-[#D00000] hover:bg-[#a00000] text-white font-semibold text-base py-5 flex items-center justify-center gap-2"
                        onClick={() => {
                            window.location.href = "/api/auth/cas";
                        }}
                    >
                        <Landmark className="w-5 h-5" /> Sign in with UNL
                    </Button>
                    <p className="text-xs text-center text-slate-500">
                        Use your UNL ID to sign in via CAS single sign-on.
                    </p>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-transparent px-2 text-slate-500">
                                or use email
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-200">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@huskers.unl.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#D00000]/50 focus:ring-[#D00000]/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-slate-200">
                            Password
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#D00000]/50 focus:ring-[#D00000]/20"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 pt-2 mt-4">
                    <Button
                        type="submit"
                        className="w-full bg-white/10 hover:bg-white/20 text-white font-medium"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </Button>
                    <p className="text-sm text-slate-400">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/register"
                            className="text-red-400 hover:text-red-300 font-medium underline underline-offset-4"
                        >
                            Create one
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="animate-pulse rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center text-slate-400">
                Loading…
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
