"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";

type Status = "loading" | "authed" | "guest";
type AuthState = { status: Status; user: AuthUser | null };
type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.session();
      setState(user ? { status: "authed", user } : { status: "guest", user: null });
    } catch {
      // Network failure: keep what we had; only an initial load falls back to guest.
      setState((s) => (s.status === "loading" ? { status: "guest", user: null } : s));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState({ status: "guest", user: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onExpired = () => setState({ status: "guest", user: null });
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
