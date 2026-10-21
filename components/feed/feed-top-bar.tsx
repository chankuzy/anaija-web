"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { FeedScope } from "@/lib/api/feed-types";

const OPTIONS: { value: FeedScope; label: string; sub: string }[] = [
  { value: "for_you", label: "For You", sub: "Picked for you" },
  { value: "following", label: "Following", sub: "People you follow" },
  { value: "campus", label: "Campus", sub: "From your institution" },
];

export function FeedTopBar({
  authed,
  scope,
  onScope,
}: {
  authed: boolean;
  scope: FeedScope;
  onScope: (s: FeedScope) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === scope) ?? OPTIONS[0];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
      <div
        className="feed-col fade-top pointer-events-auto relative px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}
      >
        <div className="hidden h-3 md:block" />
        <div className="relative flex h-11 items-center justify-between">
          {authed ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="text-shadow flex items-center gap-1.5 rounded-full bg-black/35 py-2 pl-4 pr-3 text-[15px] font-bold text-white backdrop-blur-md"
            >
              {current.label}
              <Icon name="chevronDown" className="size-4" />
            </button>
          ) : (
            <span className="text-shadow text-[17px] font-bold text-white">For You</span>
          )}

          {authed ? (
            <Link href="/notifications" aria-label="Notifications" className="icon-shadow grid size-[42px] place-items-center text-white">
              <Icon name="bell" className="size-[25px]" />
            </Link>
          ) : (
            <Link href="/login" className="rounded-full bg-white px-[18px] py-[9px] text-body font-bold text-black">
              Sign in
            </Link>
          )}

          {open && (
            <>
              <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
              <div className="glass absolute left-0 top-full z-50 mt-2 w-60 rounded-card p-1.5">
                {OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onScope(o.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left hover:bg-white/8"
                  >
                    <span>
                      <span className="block text-[15px] font-semibold text-white">{o.label}</span>
                      <span className="block text-xs text-white/55">{o.sub}</span>
                    </span>
                    {o.value === scope && <Icon name="check" className="size-4 text-accent" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
