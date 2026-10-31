/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import Script from "next/script";
import { Playfair_Display } from "next/font/google";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { needsProfileSetup } from "@/lib/auth/guards";
import { readNext } from "@/lib/auth/next";
import { Showcase } from "./showcase";
import { GOOGLE_SCRIPT, useGoogleSignIn } from "./use-google-signin";

const playfair = Playfair_Display({ subsets: ["latin"], weight: "500", display: "swap" });

// Dedicated route: stays as the fallback for direct navigation. Normal in-app sign-in uses the auth modal.
export function GoogleLogin() {
  const router = useRouter();
  const { status, user } = useAuth();
  const { btnRef, busy, error, init } = useGoogleSignIn();

  // Mirrors _navigate(): new / incomplete profiles go to setup, everyone else to the feed.
  useEffect(() => {
    if (status === "authed") {
      const next = readNext();
      router.replace(needsProfileSetup(user) ? `/setup?next=${encodeURIComponent(next)}` : next);
    }
  }, [status, user, router]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-bg md:grid md:grid-cols-[1.1fr_1fr]">
      <Script src={GOOGLE_SCRIPT} strategy="afterInteractive" onReady={init} />

      {/* showcase */}
      <section
        className="relative flex flex-none flex-col items-center justify-center px-6 md:min-h-dvh md:py-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <div className="mb-6 hidden max-w-[480px] text-center md:block">
          <h2 className={`${playfair.className} text-[44px] font-medium leading-[1.1] tracking-[-0.02em] text-fg`}>
            Hustle. Flex. <span className="text-brand">Earn.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-normal text-white/55">Reels, stories and a campus marketplace, all in one app.</p>
        </div>
        <div className="w-full [mask-image:linear-gradient(to_bottom,#000_62%,transparent)] md:[mask-image:none]">
          <Showcase />
        </div>
      </section>

      {/* sign in */}
      <section
        className="relative z-10 flex flex-1 flex-col justify-end px-7 md:justify-center md:bg-white/[0.02] md:px-12"
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
            <div className="flex min-h-[44px] w-full justify-center" aria-busy={busy}>
              <div ref={btnRef} style={{ colorScheme: "light" }} className={busy ? "pointer-events-none opacity-50" : ""} />
            </div>

            {busy && <p className="mt-3 text-sm text-white/60">Signing you in…</p>}
            {error && (
              <p role="alert" className="mt-3 text-center text-sm text-danger">
                {error}
              </p>
            )}

            <Link href="/" onClick={(e) => { e.preventDefault(); router.push(readNext()); }} className="mt-4 px-4 py-2 text-sm font-semibold text-white/75 hover:text-white">
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
