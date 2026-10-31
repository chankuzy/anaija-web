"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (c: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// The one Google sign-in implementation. The /login page and the auth modal both use it, so validation,
// session handling and error copy can never drift apart.
export function useGoogleSignIn(o: { theme?: "outline" | "filled_white"; maxWidth?: number; onSuccess?: (user: AuthUser) => void } = {}) {
  const { theme = "filled_white", maxWidth = 320, onSuccess } = o;
  const { refresh } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    CLIENT_ID ? null : "Google sign-in isn't configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID).",
  );

  // Kept in refs so the Google callback (registered once) never goes stale.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  const onCredential = useRef<(c: string) => void>(() => {});
  useEffect(() => {
    onCredential.current = (credential: string) => {
      setBusy(true);
      setError(null);
      authApi
        .socialLogin(credential)
        .then(async (r) => {
          await refresh();
          onSuccessRef.current?.(r.user);
        })
        .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong."))
        .finally(() => setBusy(false));
    };
  });

  const init = useCallback(() => {
    const g = window.google?.accounts.id;
    const el = btnRef.current;
    if (!g || !el || !CLIENT_ID) return;
    g.initialize({
      client_id: CLIENT_ID,
      callback: (r) => {
        if (r.credential) onCredential.current(r.credential);
      },
    });
    g.renderButton(el, {
      type: "standard",
      theme,
      shape: "pill",
      size: "large",
      text: "continue_with",
      width: Math.round(Math.min(maxWidth, el.clientWidth || maxWidth)),
    });
    setReady(true);
  }, [theme, maxWidth]);

  return { btnRef, busy, ready, error, init };
}
