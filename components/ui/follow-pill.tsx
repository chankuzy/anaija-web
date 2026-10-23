"use client";

import { Icon } from "@/components/ui/icon";

// Follow is the brand rose with a soft glow; Following is quiet glass, so the state change reads at a glance.
export function FollowPill({
  following,
  onClick,
  className = "",
}: {
  following: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={following}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold transition-[background,transform,box-shadow] duration-200 active:scale-95 ${
        following
          ? "border border-white/30 bg-white/12 text-white backdrop-blur-md"
          : "bg-brand text-brand-fg shadow-[0_0_18px_var(--color-brand-glow)] hover:bg-brand-hover"
      } ${className}`}
    >
      <Icon name={following ? "check" : "plus"} weight="strong" className="size-4" />
      {following ? "Following" : "Follow"}
    </button>
  );
}
