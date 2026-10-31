"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { Wordmark } from "@/components/ui/wordmark";
import type { AuthMode } from "@/lib/auth/auth-modal";
import type { AuthUser } from "@/lib/api/types";
import { GOOGLE_SCRIPT, useGoogleSignIn } from "./use-google-signin";

const FOCUSABLE = 'button:not([disabled]),a[href],iframe,[role="button"],[tabindex]:not([tabindex="-1"])';

// One dialog for sign in and join. Google handles both (new accounts continue to profile setup), so the two
// modes differ only in copy. Bottom sheet on mobile, centred dialog from md up.
export function AuthModal({
  mode,
  reason,
  onMode,
  onClose,
  onDone,
}: {
  mode: AuthMode;
  reason?: string;
  onMode: (m: AuthMode) => void;
  onClose: () => void;
  onDone: (user: AuthUser) => void;
}) {
  const g = useGoogleSignIn({ theme: "filled_white", maxWidth: 320, onSuccess: onDone });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const items = panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const join = mode === "join";
  return (
    <div className="am fixed inset-0 z-[80] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="am-title" onKeyDown={onKeyDown}>
      <Script src={GOOGLE_SCRIPT} strategy="afterInteractive" onReady={g.init} />
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="am-overlay absolute inset-0 cursor-default bg-black/60" />

      <div
        ref={panel}
        tabIndex={-1}
        className="am-panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-bg px-6 pt-3 text-fg ring-1 ring-white/[0.08] shadow-[0_-12px_48px_rgba(0,0,0,0.5)] outline-none md:max-w-[400px] md:rounded-[28px] md:px-8 md:pt-8 md:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-9 rounded-full bg-surface-elevated md:hidden" />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-interactive md:right-4 md:top-4"
        >
          <Icon name="close" weight="regular" className="size-5" />
        </button>

        <div className="flex justify-center md:justify-start">
          <Wordmark />
        </div>

        <div role="tablist" aria-label="Account" className="relative mt-5 grid h-11 grid-cols-2 rounded-full bg-surface-interactive p-1 text-[14px] font-semibold">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-surface-elevated transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: join ? "translateX(100%)" : "none" }}
          />
          {(["signin", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onMode(m)}
              className={`relative z-10 rounded-full transition-colors ${mode === m ? "text-fg" : "text-muted"}`}
            >
              {m === "signin" ? "Sign in" : "Join"}
            </button>
          ))}
        </div>

        <div key={mode} className="am-swap mt-6 text-center">
          <h2 id="am-title" className="text-[22px] font-bold tracking-[-0.015em]">
            {join ? "Join Anaija" : "Welcome back"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-[32ch] text-[14px] leading-snug text-muted">
            {join ? "Be seen. Find your people. Make something happen." : (reason ?? "Sign in to pick up where you left off.")}
          </p>
        </div>

        <div className="mt-6 flex min-h-[44px] w-full justify-center" aria-busy={g.busy}>
          <div className="relative w-full">
            {!g.ready && !g.error && <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-surface-interactive" />}
            <div ref={g.btnRef} style={{ colorScheme: "light" }} className={`flex min-h-[44px] w-full justify-center ${g.busy ? "pointer-events-none opacity-50" : ""}`} />
          </div>
        </div>

        {g.busy && <p className="mt-3 text-center text-[13px] text-muted">Signing you in…</p>}
        {g.error && (
          <p role="alert" className="mt-3 text-center text-[13px] text-danger">
            {g.error}
          </p>
        )}

        <p key={`n-${mode}`} className="am-swap mt-4 text-center text-[13px] text-muted">
          {join ? "One tap with Google. No password to remember." : "We use your Google account. No password needed."}
        </p>
        <p className="mt-4 text-center text-[12px] leading-normal text-muted">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
