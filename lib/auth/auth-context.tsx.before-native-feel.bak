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

const GUEST: AuthState = { status: "guest", user: null };
const toState = (user: AuthUser | null): AuthState =>
  user ? { status: "authed", user } : GUEST;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  // Event-handler use only (e.g. after OTP verify). Never called from an effect body.
  const refresh = useCallback(async () => {
    try {
      setState(toState(await authApi.session()));
    } catch {
      // Network failure: keep what we had; only an initial load falls back to guest.
      setState((s) => (s.status === "loading" ? GUEST : s));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState(GUEST);
    }
  }, []);

  // Initial session check: setState only inside promise callbacks.
  useEffect(() => {
    let cancelled = false;
    authApi
      .session()
      .then((user) => {
        if (!cancelled) setState(toState(user));
      })
      .catch(() => {
        if (!cancelled) setState((s) => (s.status === "loading" ? GUEST : s));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setState(GUEST);
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
