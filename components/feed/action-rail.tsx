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
  children,
}: {
  aria: string;
  label?: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex flex-col items-center gap-[3px] text-white transition-transform active:scale-90"
    >
      <span className="icon-shadow">{children}</span>
      {label ? <span className="text-shadow text-[11.5px] font-bold">{label}</span> : null}
    </button>
  );
}

// Order follows Flutter: mute, like, comment, repost, bookmark, share, options.
// Comment is added once its contract is wired.
export function ActionRail({
  post,
  hasMute,
  onLike,
  onComment,
  onBookmark,
  onRepost,
  onShare,
  onOptions,
}: {
  post: Post;
  hasMute: boolean;
  onLike: () => void;
  onComment: () => void;
  onBookmark: () => void;
  onRepost: () => void;
  onShare: () => void;
  onOptions: () => void;
}) {
  const { muted, toggleMute } = usePlayback();
  return (
    <div className="flex flex-col items-center gap-3.5">
      {hasMute && (
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={toggleMute}
          className="mb-1 grid size-[38px] place-items-center rounded-full border border-white/30 bg-black/45 text-white shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
        >
          <Icon name={muted ? "volumeOff" : "volumeOn"} className="size-[19px]" />
        </button>
      )}
      <RailButton aria="Like" pressed={post.is_liked} label={formatCount(post.likes_count)} onClick={onLike}>
        <Icon name="heart" filled className={`size-[34px] ${post.is_liked ? "text-danger" : "text-white"}`} />
      </RailButton>
      <RailButton aria="Comments" label={formatCount(post.comments_count)} onClick={onComment}>
        <Icon name="message" filled className="size-[34px]" />
      </RailButton>
      {post.type === "post" && (
        <RailButton aria="Repost" pressed={post.is_reposted} label={formatCount(post.reposts_count)} onClick={onRepost}>
          <Icon name="repeat" className={`size-[32px] ${post.is_reposted ? "text-accent" : "text-white"}`} />
        </RailButton>
      )}
      <RailButton
        aria="Bookmark"
        pressed={post.is_bookmarked}
        label={formatCount(post.bookmarks_count)}
        onClick={onBookmark}
      >
        <Icon name="bookmark" filled className={`size-[34px] ${post.is_bookmarked ? "text-warm" : "text-white"}`} />
      </RailButton>
      <RailButton aria="Share" label={formatCount(post.shares_count)} onClick={onShare}>
        <Icon name="share" className="size-[34px]" />
      </RailButton>
      <RailButton aria="More options" onClick={onOptions}>
        <Icon name="dots" filled className="size-[30px]" />
      </RailButton>
    </div>
  );
}
