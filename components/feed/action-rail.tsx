"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { formatCount } from "@/lib/format";
import type { Post } from "@/lib/api/feed-types";
import { usePlayback } from "./playback-context";

function RailButton({
  aria,
  label,
  onClick,
  pressed,
  side,
  children,
}: {
  aria: string;
  label?: string;
  onClick: () => void;
  pressed?: boolean;
  side?: boolean;
  children: ReactNode;
}) {
  if (side) {
    return (
      <button
        type="button"
        aria-label={aria}
        aria-pressed={pressed}
        onClick={onClick}
        className="flex flex-col items-center gap-1 text-white transition-transform active:scale-90"
      >
        <span className="grid size-12 place-items-center rounded-full bg-surface-interactive transition-colors hover:bg-surface-elevated">
          {children}
        </span>
        {label ? <span className="text-supporting font-semibold text-white/80">{label}</span> : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={aria}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex flex-col items-center gap-[3px] text-white transition-transform active:scale-90"
    >
      <span className="icon-shadow">{children}</span>
      {label ? <span className="text-shadow text-supporting font-bold">{label}</span> : null}
    </button>
  );
}

// Order: mute, like, comment, bookmark, share, options (repost lives in the share sheet).
// side = desktop variant: round dark buttons that sit outside the card, TikTok-web style.
export function ActionRail({
  post,
  hasMute,
  side = false,
  onLike,
  onComment,
  onBookmark,
  onShare,
  onOptions,
}: {
  post: Post;
  hasMute: boolean;
  side?: boolean;
  onLike: () => void;
  onComment: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onOptions: () => void;
}) {
  const { muted, toggleMute } = usePlayback();
  const big = side ? "size-7" : "size-[34px]";
  return (
    <div className={`flex flex-col items-center ${side ? "gap-3" : "gap-3.5"}`}>
      {hasMute &&
        (side ? (
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
            className="mb-1 grid size-12 place-items-center rounded-full bg-surface-interactive text-white transition-colors hover:bg-surface-elevated"
          >
            <Icon name={muted ? "volumeOff" : "volumeOn"} className="size-6" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
            className="mb-1 grid size-[38px] place-items-center rounded-full bg-black/45 text-white"
          >
            <Icon name={muted ? "volumeOff" : "volumeOn"} className="size-[19px]" />
          </button>
        ))}
      <RailButton aria="Like" side={side} pressed={post.is_liked} label={formatCount(post.likes_count)} onClick={onLike}>
        <Icon name="heart" filled className={`${big} ${post.is_liked ? "text-like" : "text-white"}`} />
      </RailButton>
      <RailButton aria="Comments" side={side} label={formatCount(post.comments_count)} onClick={onComment}>
        <Icon name="message" filled className={big} />
      </RailButton>
      <RailButton
        aria="Bookmark"
        side={side}
        pressed={post.is_bookmarked}
        label={formatCount(post.bookmarks_count)}
        onClick={onBookmark}
      >
        <Icon name="bookmark" filled className={`${big} ${post.is_bookmarked ? "text-brand" : "text-white"}`} />
      </RailButton>
      <RailButton aria="Share" side={side} label={formatCount(post.shares_count)} onClick={onShare}>
        <Icon name="shareArrow" filled className={big} />
      </RailButton>
      <RailButton aria="More options" side={side} onClick={onOptions}>
        <Icon name="dots" filled className={side ? "size-7" : "size-[30px]"} />
      </RailButton>
    </div>
  );
}
