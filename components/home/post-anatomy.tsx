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
  "relative inline-flex h-10 min-w-9 items-center justify-center gap-1.5 rounded-pill px-1.5 text-fg transition-[background-color,transform] duration-150 hover:bg-white/6 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-brand/80";
const ACT = "size-[26px]"; // action icons (like, comment, share, save)

// Header: avatar, the username alone on the first line, and a quiet second line (attached sound, else why you are
// seeing the post, else the location) with the time at its end. Follow is a calm pill; yellow is kept for state
// (saved, liked). Horizontal padding is the host's job (HomePost).
export function PostHeader({
  post,
  isOwn,
  following,
  onFollow,
  onMore,
  reason,
}: {
  post: Post;
  isOwn: boolean;
  following: boolean;
  onFollow: () => Promise<unknown>;
  onMore: () => void;
  /** Why this post is in the viewer's feed ("Suggested for you"). Shown when the post has no attached sound. */
  reason?: string | null;
}) {
  const a = post.author;
  const { status } = useAuth();
  const ring = useStoryRing(a?.id, status === "authed" && !!a);
  const href = a?.username ? `/u/${a.username}` : null;
  const d = post.listing;
  const where = d?.location_info ? formatCompactLocation(d.location_info) : (post.location ?? d?.pickup_info ?? null);
  const when = timeAgo(post.created_at);
  const sound = post.audio?.enabled ? (post.audio.name ?? "").trim() : "";
  // The backend does not send a verified flag for authors yet, so no badge is drawn.
  const lead = sound ? (
    <span className="flex min-w-0 items-center gap-1">
      <Icon name="musicNote" filled className="size-3.5 shrink-0" />
      <span className="truncate">{sound}</span>
    </span>
  ) : reason ? (
    <span className="min-w-0 truncate">{reason}</span>
  ) : where ? (
    <span className="min-w-0 truncate">{where}</span>
  ) : null;
  const sub =
    lead || when ? (
      <span className="mt-px flex min-w-0 items-center gap-1.5 text-supporting text-muted">
        {lead}
        {lead && when && (
          <span aria-hidden className="shrink-0">
            ·
          </span>
        )}
        {when && <span className="shrink-0">{when}</span>}
      </span>
    ) : null;
  const who = (
    <>
      <ProfileHoverCard username={a?.username}>
        <StoryRingAvatar url={a?.avatar} name={a?.name ?? a?.username} size={38} ring={ring} />
      </ProfileHoverCard>
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold leading-[1.25] tracking-tight text-fg">
          {a?.username ?? a?.name ?? "Anaija"}
        </span>
        {sub}
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
          className="hit-area relative h-7 rounded-pill bg-white/8 px-3.5 text-secondary font-semibold text-fg transition-[background-color,transform] duration-150 hover:bg-white/14 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          Follow
        </button>
      )}
      <button type="button" aria-label="More options" aria-haspopup="dialog" onClick={onMore} className={`${BTN} -mr-1.5 text-fg/70`}>
        <Icon name="dots" filled className="size-6" />
      </button>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

// Like, comment, share on the left; save on the right. Icons only on phones and tablets, with the counts beside them
// from lg up. Below lg the numbers live in the stats line under the row: likes lead in white, the rest sit muted.
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
  const count = (n: number) =>
    n > 0 ? <span className="hidden text-body font-semibold tabular-nums lg:inline">{formatCount(n)}</span> : null;
  const secondary = [
    post.bookmarks_count > 0 && plural(post.bookmarks_count, "save", "saves"),
    post.shares_count > 0 && plural(post.shares_count, "share", "shares"),
  ].filter(Boolean) as string[];
  const hasStats = post.likes_count > 0 || secondary.length > 0;
  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <div className="-ml-1.5 flex items-center">
          <button type="button" aria-label={post.is_liked ? "Unlike" : "Like"} aria-pressed={post.is_liked} onClick={onLike} className={BTN}>
            <Icon name="heart" filled={post.is_liked} className={`${ACT} ${post.is_liked ? "text-like" : ""}`} />
            {count(post.likes_count)}
          </button>
          <button type="button" aria-label="Comments" onClick={onComment} className={`${BTN} ${post.allow_comments ? "" : "opacity-50"}`}>
            <Icon name="chatLine" className={ACT} />
            {count(post.comments_count)}
          </button>
          <button type="button" aria-label="Share" onClick={onShare} className={BTN}>
            <Icon name="shareArrow" className={ACT} />
            {count(post.shares_count)}
          </button>
        </div>
        <button
          type="button"
          aria-label={post.is_bookmarked ? "Remove bookmark" : "Bookmark"}
          aria-pressed={post.is_bookmarked}
          onClick={onBookmark}
          className={`${BTN} -mr-1.5`}
        >
          <Icon name="bookmark" filled={post.is_bookmarked} className={`${ACT} ${post.is_bookmarked ? "text-brand" : ""}`} />
          {count(post.bookmarks_count)}
        </button>
      </div>
      {hasStats && (
        <p className="mt-0.5 text-body text-muted lg:hidden">
          {post.likes_count > 0 && <span className="font-semibold text-fg">{plural(post.likes_count, "like", "likes")}</span>}
          {secondary.map((s, i) => (
            <span key={s}>
              {post.likes_count > 0 || i > 0 ? " · " : ""}
              {s}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

export function PostCaption({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const text = withHashtags(post.caption, post.hashtags);
  if (!text) return null;
  const long = text.length > 120 || text.includes("\n");
  return (
    <div className="mt-1 text-body leading-[1.45] text-fg/90">
      <p className={`selectable ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
        {post.author?.username && <span className="mr-1.5 font-semibold text-fg">{post.author.username}</span>}
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
