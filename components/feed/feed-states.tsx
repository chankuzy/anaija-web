"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import type { FeedScope } from "@/lib/api/feed-types";

const pageBg = "bg-[linear-gradient(to_bottom,#111,#000)]";

export function FeedSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="feed-card relative overflow-hidden bg-[linear-gradient(to_bottom,#0c0c0c,#000)]">
        <div className="absolute bottom-6 right-3 flex flex-col gap-5" style={{ marginBottom: "var(--nav-h)" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="size-[34px] animate-pulse rounded-full bg-white/8" />
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-5 flex flex-col gap-3" style={{ marginBottom: "var(--nav-h)" }}>
          <div className="flex items-center gap-2.5">
            <div className="size-[38px] animate-pulse rounded-full bg-white/8" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-28 animate-pulse rounded-lg bg-white/8" />
              <div className="h-2.5 w-16 animate-pulse rounded-lg bg-white/8" />
            </div>
          </div>
          <div className="h-3 w-full animate-pulse rounded-lg bg-white/8" />
          <div className="h-3 w-44 animate-pulse rounded-lg bg-white/8" />
        </div>
      </div>
    </div>
  );
}

export function FeedError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-secondary text-muted">{message}</p>
      <button type="button" onClick={onRetry} className="text-sm font-bold text-fg">
        Try again
      </button>
    </div>
  );
}

const EMPTY: Record<FeedScope, { title: string; sub: string; cta: string; href: string }> = {
  reels: {
    title: "No reels yet",
    sub: "Videos and audio reels from campus will show up here",
    cta: "Create reel",
    href: "/create/new",
  },
  for_you: {
    title: "No posts here yet",
    sub: "Be the first to share a moment on campus",
    cta: "Create Post",
    href: "/create/new",
  },
  following: {
    title: "No posts from accounts you follow",
    sub: "Discover active creators on campus and follow them to see their posts here",
    cta: "Discover People",
    href: "/discover",
  },
  campus: {
    title: "No campus posts yet",
    sub: "Connect with your institution to see stories and updates from classmates",
    cta: "Create Post",
    href: "/create/new",
  },
};

export function FeedEmpty({ scope }: { scope: FeedScope }) {
  const e = EMPTY[scope];
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-2 px-9 text-center">
      <h2 className="text-lg font-bold text-white">{e.title}</h2>
      <p className="max-w-xs text-secondary leading-snug text-white/60">{e.sub}</p>
      <Link href={e.href} className={buttonClass("outline", "mt-5 h-11 text-secondary")}>
        {e.cta}
      </Link>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  sign_up: "Sign up to personalise your feed",
  refresh: "Refresh",
  discover_people: "Discover people",
  discover_marketplace: "Browse the marketplace",
};
const ACTION_HREF: Record<string, string> = {
  sign_up: "/login",
  discover_people: "/discover",
  discover_marketplace: "/discover", // Flutter sends both to the Discover tab
};

export function CaughtUp({
  actions,
  isGuest,
  busy,
  onRefresh,
}: {
  actions: string[];
  isGuest: boolean;
  busy: boolean;
  onRefresh: () => void;
}) {
  const list = actions.filter((a) => a in ACTION_LABELS);
  if (list.length === 0) list.push("refresh");

  return (
    <section className="relative flex h-dvh snap-start items-center justify-center">
      <div className={`feed-card relative flex flex-col items-center justify-center px-8 text-center ${pageBg}`}>
        <h2 className="text-[22px] font-extrabold text-white">You&apos;re all caught up</h2>
        <p className="mb-6 mt-2 max-w-xs text-body leading-snug text-white/60">
          {isGuest
            ? "That's everything public on Anaija right now. Sign up to follow people and get a feed built around you."
            : "You've seen everything for now. New posts land all the time."}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          {list.map((a, i) => {
            const cls =
              i === 0
                ? "h-12 w-full rounded-full bg-brand text-[15px] font-extrabold text-brand-fg disabled:opacity-60 inline-flex items-center justify-center"
                : "h-12 w-full rounded-full bg-white/12 text-[15px] font-bold text-white inline-flex items-center justify-center";
            return a === "refresh" ? (
              <button key={a} type="button" disabled={busy} onClick={onRefresh} className={cls}>
                {busy ? "Refreshing…" : ACTION_LABELS[a]}
              </button>
            ) : (
              <Link key={a} href={ACTION_HREF[a] ?? "/discover"} className={cls}>
                {ACTION_LABELS[a]}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
