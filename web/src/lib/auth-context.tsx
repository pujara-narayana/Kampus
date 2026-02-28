"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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

  useEffect(() => {
    const token = localStorage.getItem("kampus_token");
    const savedUser = localStorage.getItem("kampus_user");
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("kampus_token");
        localStorage.removeItem("kampus_user");
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    localStorage.setItem("kampus_token", res.token);
    localStorage.setItem("kampus_user", JSON.stringify(res.user));
    setUser(res.user as unknown as User);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.register({ email, password, displayName });
    localStorage.setItem("kampus_token", res.token);
    localStorage.setItem("kampus_user", JSON.stringify(res.user));
    setUser(res.user as unknown as User);
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
