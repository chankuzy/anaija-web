"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import { clearCache } from "@/lib/cache/swr";

type Status = "loading" | "authed" | "guest";
type AuthState = { status: Status; user: AuthUser | null };
type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

// What the server could establish before first paint. "unknown" = a cookie exists but the upstream
// didn't answer in time: never treated as a guest.
export type InitialAuth =
  | { status: "authed"; user: AuthUser }
  | { status: "guest" }
  | { status: "unknown" };

const GUEST: AuthState = { status: "guest", user: null };
const toState = (user: AuthUser | null): AuthState =>
  user ? { status: "authed", user } : GUEST;

const USER_KEY = "anaija:user";
const UID_KEY = "anaija:uid";
const uidOf = (u: AuthUser) => String((u as { id?: number | string }).id ?? u.username ?? "");

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, initial }: { children: React.ReactNode; initial: InitialAuth }) {
  const [state, setState] = useState<AuthState>(() =>
    initial.status === "authed"
      ? { status: "authed", user: initial.user }
      : initial.status === "guest"
        ? GUEST
        : { status: "loading", user: null },
  );

  // Event-handler use only (e.g. after OTP verify). Never called from an effect body.
  const refresh = useCallback(async () => {
    try {
      setState(toState(await authApi.session()));
    } catch {
      // Network failure: keep what we had.
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState(GUEST);
      void clearCache();
    }
  }, []);

  // Only when the server couldn't verify the cookie: retry with backoff, show the last known user meanwhile,
  // and never fall back to guest on a network error.
  useEffect(() => {
    if (initial.status !== "unknown") return;
    let cancelled = false;
    let timer: number | undefined;
    const adoptCached = () => {
      const cached = readCachedUser();
      if (cached) setState((s) => (s.status === "loading" ? { status: "authed", user: cached } : s));
    };
    const attempt = (n: number) => {
      authApi
        .session()
        .then((user) => {
          if (!cancelled) setState(toState(user));
        })
        .catch(() => {
          if (cancelled) return;
          adoptCached();
          timer = window.setTimeout(() => attempt(n + 1), Math.min(1000 * 2 ** n, 15000));
        });
    };
    attempt(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [initial.status]);

  useEffect(() => {
    const onExpired = () => setState(GUEST);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Remember the user for offline/slow starts, and wipe every cached byte whenever the account changes.
  useEffect(() => {
    if (state.status === "loading") return;
    try {
      const want = state.status === "authed" && state.user ? uidOf(state.user) : "";
      const prev = localStorage.getItem(UID_KEY) ?? "";
      if (want !== prev) {
        void clearCache();
        if (want) localStorage.setItem(UID_KEY, want);
        else localStorage.removeItem(UID_KEY);
      }
      if (state.user) localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      else localStorage.removeItem(USER_KEY);
    } catch {
      // storage unavailable: caching just degrades
    }
  }, [state]);

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
