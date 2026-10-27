"use client";

import Link from "next/link";
import { AppLogo } from "@/components/ui/app-logo";
import { Icon } from "@/components/ui/icon";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useActivity } from "@/lib/activity/activity-context";
import type { FeedScope } from "@/lib/api/feed-types";

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: "for_you", label: "For You" },
  { value: "following", label: "Following" },
  { value: "campus", label: "Campus" },
];

export function HomeHeader({ authed, scope, onScope }: { authed: boolean; scope: FeedScope; onScope: (s: FeedScope) => void }) {
  const { unseen } = useActivity();
  return (
    <header className="sticky top-0 z-30 bg-bg px-4 md:px-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Anaija home" className="shrink-0 md:hidden">
            <AppLogo size={28} showWordmark={false} />
          </Link>
          {authed ? (
            <div role="tablist" aria-label="Feed" className="flex items-center gap-1">
              {SCOPES.map((s) => {
                const on = s.value === scope;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => onScope(s.value)}
                    className={`h-9 rounded-pill px-3.5 text-secondary font-semibold transition-colors motion-reduce:transition-none ${
                      on ? "bg-brand text-brand-fg" : "text-muted hover:bg-white/6 hover:text-fg"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-label font-bold text-fg">For You</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/watch"
            aria-label="Reels"
            className="inline-flex h-10 items-center gap-2 rounded-pill bg-surface-interactive px-3 text-secondary font-semibold text-fg transition-colors hover:bg-surface-elevated"
          >
            <Icon name="clapperboard" className="size-5" />
            <span className="hidden sm:inline">Reels</span>
          </Link>
          {authed ? (
            <Link href="/notifications" aria-label="Notifications" className="relative grid size-11 place-items-center text-fg md:hidden">
              <Icon name="bell" filled={unseen > 0} className="size-[26px]" />
              {unseen > 0 && (
                <span className="absolute right-0.5 top-0.5">
                  <UnreadBadge count={unseen} label="new notifications" />
                </span>
              )}
            </Link>
          ) : (
            <Link href="/login" className="inline-flex h-10 items-center rounded-pill bg-brand px-4 text-secondary font-extrabold text-brand-fg">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
