"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

export default function RegisterPage() {
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { register } = useAuth();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await register(email, password, displayName);
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-white">
                    Create your account
                </CardTitle>
                <CardDescription className="text-slate-400">
                    Join Kampus and unify your campus life
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-slate-200">
                            Display Name
                        </Label>
                        <Input
                            id="displayName"
                            placeholder="Your name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#D00000]/50 focus:ring-[#D00000]/20"
                        />
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
                            minLength={6}
                            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#D00000]/50 focus:ring-[#D00000]/20"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <Button
                        type="submit"
                        className="w-full bg-[#D00000] hover:bg-[#a00000] text-white font-medium"
                        disabled={loading}
                    >
                        {loading ? "Creating account..." : "Create Account"}
                    </Button>
                    <p className="text-sm text-slate-400">
                        Already have an account?{" "}
                        <Link
                            href="/login"
                            className="text-red-400 hover:text-red-300 font-medium underline underline-offset-4"
                        >
                            Sign in
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
