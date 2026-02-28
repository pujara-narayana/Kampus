"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "./api-client";

interface User {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Notify the Kampus extension (if installed) about the new token
  function notifyExtension(token: string, userJson: string) {
    try {
      window.postMessage({
        type: 'KAMPUS_TOKEN_BRIDGE',
        token,
        user: userJson,
      }, '*');
    } catch {
      // Extension may not be installed
    }
  }

  useEffect(() => {
    // Check for CAS callback token in URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const casToken = params.get("token");
      if (casToken) {
        localStorage.setItem("kampus_token", casToken);
        notifyExtension(casToken, '');
        // Fetch user profile with the new token
        fetchProfile(casToken);
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.pathname);
        return;
      }
    }

    const token = localStorage.getItem("kampus_token");
    const savedUser = localStorage.getItem("kampus_user");
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        // Notify extension on every page load where user is logged in
        notifyExtension(token, savedUser);
      } catch {
        localStorage.removeItem("kampus_token");
        localStorage.removeItem("kampus_user");
      }
    }
    setLoading(false);
  }, []);

  async function fetchProfile(token: string) {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("kampus_user", JSON.stringify(data.user));
        setUser(data.user);
        notifyExtension(token, JSON.stringify(data.user));
      }
    } catch {
      // Token might be invalid
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    localStorage.setItem("kampus_token", res.token);
    localStorage.setItem("kampus_user", JSON.stringify(res.user));
    setUser(res.user as unknown as User);
    notifyExtension(res.token, JSON.stringify(res.user));
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.register({ email, password, displayName });
    localStorage.setItem("kampus_token", res.token);
    localStorage.setItem("kampus_user", JSON.stringify(res.user));
    setUser(res.user as unknown as User);
    notifyExtension(res.token, JSON.stringify(res.user));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("kampus_token");
    localStorage.removeItem("kampus_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
