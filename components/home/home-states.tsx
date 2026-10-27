"use client";

import Link from "next/link";
import { Sk } from "@/components/ui/skeleton";
import type { FeedScope } from "@/lib/api/feed-types";

export function HomeSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading feed">
      {[0, 1].map((i) => (
        <div key={i} className="px-4 pb-8 md:px-0">
          <div className="flex items-center gap-3 py-1">
            <Sk className="size-10 rounded-full" />
            <div className="space-y-2">
              <Sk className="h-3.5 w-28 rounded-full" />
              <Sk className="h-3 w-20 rounded-full" />
            </div>
          </div>
          <Sk className="mt-3 aspect-[4/5] w-full rounded-image" />
          <div className="mt-3 flex gap-3">
            <Sk className="h-6 w-14 rounded-full" />
            <Sk className="h-6 w-14 rounded-full" />
          </div>
          <Sk className="mt-3 h-3.5 w-full rounded-full" />
          <Sk className="mt-2 h-3.5 w-[60%] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function HomeMessage({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-2 px-9 text-center">
      <h2 className="text-label font-bold text-fg">{title}</h2>
      {sub && <p className="max-w-xs text-secondary leading-snug text-muted">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const pill = "inline-flex h-11 items-center justify-center rounded-pill px-6 text-secondary font-bold";
export const PRIMARY = `${pill} bg-brand text-brand-fg hover:bg-brand-hover`;
export const QUIET = `${pill} bg-surface-interactive text-fg hover:bg-surface-elevated`;

const EMPTY: Record<FeedScope, { title: string; sub: string; cta: string; href: string }> = {
  reels: {
    title: "No reels yet",
    sub: "Videos and audio reels from campus will show up here",
    cta: "Create reel",
    href: "/create/new",
  },
  for_you: { title: "No posts here yet", sub: "Be the first to share a moment on campus", cta: "Create post", href: "/create/new" },
  following: { title: "Nothing from people you follow", sub: "Find active creators on campus and follow them to see their posts here", cta: "Discover people", href: "/discover" },
  campus: { title: "No campus posts yet", sub: "Connect with your institution to see updates from classmates", cta: "Create post", href: "/create/new" },
};

export function HomeEmpty({ scope }: { scope: FeedScope }) {
  const e = EMPTY[scope];
  return (
    <HomeMessage
      title={e.title}
      sub={e.sub}
      action={
        <Link href={e.href} className={QUIET}>
          {e.cta}
        </Link>
      }
    />
  );
}

const ACTION_LABELS: Record<string, string> = {
  sign_up: "Sign up to personalise your feed",
  refresh: "Refresh",
  discover_people: "Discover people",
  discover_marketplace: "Browse the marketplace",
};
const ACTION_HREF: Record<string, string> = { sign_up: "/login", discover_people: "/discover", discover_marketplace: "/discover" };

export function HomeCaughtUp({ actions, isGuest, busy, onRefresh }: { actions: string[]; isGuest: boolean; busy: boolean; onRefresh: () => void }) {
  const list = actions.filter((a) => a in ACTION_LABELS);
  if (list.length === 0) list.push("refresh");
  return (
    <section className="mx-4 mb-8 rounded-image bg-surface-subtle px-6 py-8 text-center md:mx-0">
      <h2 className="text-section font-extrabold text-fg">You&apos;re all caught up</h2>
      <p className="mx-auto mt-2 max-w-xs text-body leading-snug text-muted">
        {isGuest
          ? "That's everything public on Anaija right now. Sign up to follow people and get a feed built around you."
          : "You've seen everything for now. New posts land all the time."}
      </p>
      <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2.5">
        {list.map((a, i) =>
          a === "refresh" ? (
            <button key={a} type="button" disabled={busy} onClick={onRefresh} className={`${i === 0 ? PRIMARY : QUIET} w-full disabled:opacity-60`}>
              {busy ? "Refreshing…" : ACTION_LABELS[a]}
            </button>
          ) : (
            <Link key={a} href={ACTION_HREF[a] ?? "/discover"} className={`${i === 0 ? PRIMARY : QUIET} w-full`}>
              {ACTION_LABELS[a]}
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
