/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import Script from "next/script";
import { Playfair_Display } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { needsProfileSetup } from "@/lib/auth/guards";

const playfair = Playfair_Display({ subsets: ["latin"], weight: "500", display: "swap" });

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

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleLogin() {
  const router = useRouter();
  const { status, user, refresh } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    CLIENT_ID ? null : "Google sign-in isn't configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID).",
  );

  // Mirrors _navigate(): new / incomplete profiles go to setup, everyone else to the feed.
  useEffect(() => {
    if (status === "authed") router.replace(needsProfileSetup(user) ? "/setup" : "/");
  }, [status, user, router]);

  // Kept in a ref so the Google callback (registered once) never goes stale.
  const onCredential = useRef<(c: string) => void>(() => {});
  useEffect(() => {
    onCredential.current = (credential: string) => {
      setBusy(true);
      setError(null);
      authApi
        .socialLogin(credential)
        .then(() => refresh())
        .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong."))
        .finally(() => setBusy(false));
    };
  });

  function initGoogle() {
    const g = window.google?.accounts.id;
    if (!g || !btnRef.current || !CLIENT_ID) return;
    g.initialize({
      client_id: CLIENT_ID,
      callback: (r) => {
        if (r.credential) onCredential.current(r.credential);
      },
    });
    g.renderButton(btnRef.current, {
      type: "standard",
      theme: "filled_white",
      shape: "pill",
      size: "large",
      text: "continue_with",
      width: 340,
    });
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={initGoogle} />

      <img src="/brand/anaija_bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.72) 45%, #000 80%)" }}
      />

      <div
        className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-7"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)", paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="flex-[3]" />

        <img src="/brand/anaija_logo_master.svg" alt="Anaija" className="mx-auto h-[120px] w-auto" />

        <h1
          className={`${playfair.className} mt-[26px] text-center text-[30px] font-medium leading-[1.2] tracking-[-0.02em] text-fg`}
        >
          Where Entertainment Meets
          <br />
          Opportunity 🇳🇬
        </h1>
        <p className="mt-3.5 text-center text-supporting font-semibold tracking-[0.2em] text-white/50">
          HUSTLE&nbsp;&nbsp;·&nbsp;&nbsp;FLEX&nbsp;&nbsp;·&nbsp;&nbsp;EARN
        </p>

        <div className="flex-[4]" />

        <div className="flex flex-col items-center">
          <div className="flex min-h-[44px] justify-center" aria-busy={busy}>
            <div ref={btnRef} className={busy ? "pointer-events-none opacity-50" : ""} />
          </div>

          {busy && <p className="mt-3 text-sm text-white/60">Signing you in…</p>}
          {error && (
            <p role="alert" className="mt-3 text-center text-sm text-danger">
              {error}
            </p>
          )}

          <Link href="/" className="mt-4 px-4 py-2 text-sm font-semibold text-white/75 hover:text-white">
            Browse as guest
          </Link>

          <p className="mt-3.5 text-center text-supporting leading-normal text-white/45">
            By continuing, you agree to our
            <br />
            <span className="text-white/80 underline decoration-white/35">Terms of Service</span> and{" "}
            <span className="text-white/80 underline decoration-white/35">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
