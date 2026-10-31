"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/api/types";
import { useAuth } from "./auth-context";
import { needsProfileSetup } from "./guards";
import { safeNext } from "./next";

// The modal (and the Google script it loads) is only fetched when someone actually opens it.
const AuthModal = dynamic(() => import("@/components/auth/auth-modal").then((m) => m.AuthModal), { ssr: false });

export type AuthMode = "signin" | "join";
export type AuthOpenOptions = {
  mode?: AuthMode;
  /** One sentence shown under the title, e.g. "Sign in to like posts." */
  reason?: string;
  /** Same-origin path to go to after sign-in. Omit to stay where the visitor is. */
  next?: string;
};

// Module-level so any handler can call openAuth() without a hook (same pattern as confirmDialog).
let opener: ((o?: AuthOpenOptions) => void) | null = null;

export function openAuth(o?: AuthOpenOptions) {
  if (opener) return opener(o);
  if (typeof window !== "undefined") window.location.assign(o?.next ? `/login?next=${encodeURIComponent(o.next)}` : "/login");
}

type Open = { mode: AuthMode; reason?: string; next?: string };

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [st, setSt] = useState<Open | null>(null);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  });

  useEffect(() => {
    opener = (o) => {
      if (statusRef.current === "authed") {
        const n = safeNext(o?.next);
        if (n) router.push(n);
        return;
      }
      setSt({ mode: o?.mode ?? "signin", reason: o?.reason, next: safeNext(o?.next) ?? undefined });
    };
    return () => {
      opener = null;
    };
  }, [router]);

  // Every existing <Link href="/login?next=..."> opens the modal instead of a full-screen page.
  // The /login route itself still works for direct navigation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (href !== "/login" && !href.startsWith("/login?")) return;
      const path = window.location.pathname;
      if (statusRef.current === "authed" || path === "/login" || path === "/setup") return;
      e.preventDefault();
      e.stopPropagation();
      const next = new URL(href, window.location.origin).searchParams.get("next");
      opener?.({ next: next ?? undefined, mode: a.dataset.authMode === "join" ? "join" : "signin" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // If the session appears some other way while the modal is open, drop it (timeout: not a synchronous setState).
  useEffect(() => {
    if (status !== "authed" || !st) return;
    const t = window.setTimeout(() => setSt(null), 0);
    return () => window.clearTimeout(t);
  }, [status, st]);

  const close = useCallback(() => setSt(null), []);

  const done = useCallback(
    (user: AuthUser) => {
      const next = st?.next;
      setSt(null);
      // New profiles go through /setup (AppShell also guards this); keep the intended destination through it.
      if (needsProfileSetup(user)) {
        if (next) router.replace(`/setup?next=${encodeURIComponent(next)}`);
      } else if (next) {
        router.push(next);
      }
    },
    [st, router],
  );

  return (
    <>
      {children}
      {st && status !== "authed" && (
        <AuthModal mode={st.mode} reason={st.reason} onMode={(mode) => setSt((s) => (s ? { ...s, mode } : s))} onClose={close} onDone={done} />
      )}
    </>
  );
}
