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
import { readNext } from "@/lib/auth/next";
import { Showcase } from "./showcase";

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
    if (status === "authed") router.replace(needsProfileSetup(user) ? "/setup" : readNext());
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
      width: 320,
    });
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg md:grid md:grid-cols-[1.1fr_1fr]">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={initGoogle} />

      {/* showcase */}
      <section
        className="relative flex flex-none flex-col items-center justify-center px-6 md:min-h-dvh md:py-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <div className="mb-6 hidden max-w-[480px] text-center md:block">
          <h2 className={`${playfair.className} text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-fg`}>
            Hustle. Flex. <span className="text-[#C8FA00]">Earn.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-normal text-white/55">Reels, stories and a campus marketplace, all in one app.</p>
        </div>
        <div className="w-full [mask-image:linear-gradient(to_bottom,#000_62%,transparent)] md:[mask-image:none]">
          <Showcase />
        </div>
      </section>

      {/* sign in */}
      <section
        className="relative z-10 flex flex-1 flex-col justify-end px-7 md:justify-center md:border-l md:border-white/8 md:bg-white/[0.02] md:px-12"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="mx-auto w-full max-w-[380px]">
          <img src="/brand/anaija_logo_master.svg" alt="Anaija" className="mx-auto h-[84px] w-auto md:h-[96px]" />

          <h1
            className={`${playfair.className} mt-5 text-center text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-fg md:text-[28px]`}
          >
            Where Entertainment Meets
            <br />
            Opportunity 🇳🇬
          </h1>
          <p className="mt-3 text-center text-supporting font-semibold tracking-[0.2em] text-white/50 md:hidden">
            HUSTLE&nbsp;&nbsp;·&nbsp;&nbsp;FLEX&nbsp;&nbsp;·&nbsp;&nbsp;EARN
          </p>

          <div className="mt-8 flex flex-col items-center">
            <div className="flex min-h-[44px] justify-center" aria-busy={busy}>
              <div ref={btnRef} style={{ colorScheme: "light" }} className={busy ? "pointer-events-none opacity-50" : ""} />
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
      </section>
    </div>
  );
}
