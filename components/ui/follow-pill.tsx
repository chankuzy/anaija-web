"use client";

import { Icon } from "./icon";

// Port of FeedFollowButton: translucent pill, check when following.
export function FollowPill({ following, onClick }: { following: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-2xl border px-[13px] py-[5.5px] text-xs font-semibold tracking-wide text-white transition active:scale-[0.92] ${
        following ? "border-white/35 bg-white/14" : "border-white/80 bg-white/22"
      }`}
    >
      <Icon name={following ? "check" : "plus"} className="size-[13.5px]" />
      {following ? "Following" : "Follow"}
    </button>
  );
}
