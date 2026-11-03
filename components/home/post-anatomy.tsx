"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import { StoryRingAvatar } from "@/components/profile/story-ring-avatar";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatCount, timeAgo } from "@/lib/format";
import { formatCompactLocation } from "@/lib/location/types";
import { useStoryRing } from "@/lib/stories/use-story-ring";
import { CaptionText, withHashtags } from "./caption-text";

const BTN =
  "relative inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-pill px-2 text-fg transition-[background-color,transform] duration-150 hover:bg-white/6 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-brand/80";

// Instagram anatomy: avatar, username with the time beside it, optional location line underneath, Follow, options.
// Horizontal padding is the host's job (HomePost), so these stay flush.
export function PostHeader({
  post,
  isOwn,
  following,
  onFollow,
  onMore,
}: {
  post: Post;
  isOwn: boolean;
  following: boolean;
  onFollow: () => Promise<unknown>;
  onMore: () => void;
}) {
  const a = post.author;
  const { status } = useAuth();
  const ring = useStoryRing(a?.id, status === "authed" && !!a);
  const href = a?.username ? `/u/${a.username}` : null;
  const d = post.listing;
  const where = d?.location_info ? formatCompactLocation(d.location_info) : (post.location ?? d?.pickup_info ?? null);
  const when = timeAgo(post.created_at);
  // The backend does not send a verified flag for authors yet, so no badge is drawn.
  const who = (
    <>
      <ProfileHoverCard username={a?.username}>
        <StoryRingAvatar url={a?.avatar} name={a?.name ?? a?.username} size={36} ring={ring} />
      </ProfileHoverCard>
      <span className="min-w-0">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-body font-bold text-fg">{a?.username ?? a?.name ?? "Anaija"}</span>
          {when && <span className="shrink-0 text-body text-muted">· {when}</span>}
        </span>
        {where && <span className="block truncate text-supporting text-muted">{where}</span>}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5">
          {who}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{who}</div>
      )}
      {a && !isOwn && !following && (
        <button
          type="button"
          onClick={() => void onFollow()}
          className="hit-area relative h-8 rounded-pill px-2 text-secondary font-bold text-brand transition-colors hover:text-brand-hover"
        >
          Follow
        </button>
      )}
      <button type="button" aria-label="More options" aria-haspopup="dialog" onClick={onMore} className={`${BTN} -mr-2`}>
        <Icon name="dots" filled className="size-6" />
      </button>
    </div>
  );
}

// Like, comment, share on the left with their counts beside them; save on the right.
export function PostActions({
  post,
  onLike,
  onComment,
  onShare,
  onBookmark,
}: {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
}) {
  const count = (n: number) => (n > 0 ? <span className="text-body font-semibold tabular-nums">{formatCount(n)}</span> : null);
  return (
    <div className="flex items-center justify-between pt-1">
      <div className="-ml-2 flex items-center gap-1">
        <button type="button" aria-label={post.is_liked ? "Unlike" : "Like"} aria-pressed={post.is_liked} onClick={onLike} className={BTN}>
          <Icon name="heart" filled={post.is_liked} className={`size-6 ${post.is_liked ? "text-like" : ""}`} />
          {count(post.likes_count)}
        </button>
        <button type="button" aria-label="Comments" onClick={onComment} className={`${BTN} ${post.allow_comments ? "" : "opacity-50"}`}>
          <Icon name="message" className="size-6" />
          {count(post.comments_count)}
        </button>
        <button type="button" aria-label="Share" onClick={onShare} className={BTN}>
          <Icon name="shareArrow" className="size-6" />
          {count(post.shares_count)}
        </button>
      </div>
      <button
        type="button"
        aria-label={post.is_bookmarked ? "Remove bookmark" : "Bookmark"}
        aria-pressed={post.is_bookmarked}
        onClick={onBookmark}
        className={`${BTN} -mr-2`}
      >
        <Icon name="bookmark" filled={post.is_bookmarked} className={`size-6 ${post.is_bookmarked ? "text-brand" : ""}`} />
      </button>
    </div>
  );
}

export function PostCaption({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const text = withHashtags(post.caption, post.hashtags);
  if (!text) return null;
  const long = text.length > 120 || text.includes("\n");
  return (
    <div className="mt-0.5 text-body leading-[1.4] text-fg">
      <p className={`selectable ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
        {post.author?.username && <span className="mr-1.5 font-bold">{post.author.username}</span>}
        <CaptionText text={text} />
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 text-body text-muted">
          {open ? "Show less" : "… more"}
        </button>
      )}
    </div>
  );
}
