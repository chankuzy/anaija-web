"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatCount } from "@/lib/format";
import type { Post } from "@/lib/api/feed-types";

function Tile({
  icon,
  label,
  onClick,
  href,
  destructive,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const cls = `flex w-full items-center gap-3.5 rounded-2xl px-5 py-3.5 text-left text-[15px] font-medium hover:bg-white/8 disabled:opacity-50 ${
    destructive ? "text-danger" : "text-fg"
  }`;
  const inner = (
    <>
      <Icon name={icon} className="size-5" />
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

// Owner-only strip: how this post is doing.
function Insights({ post }: { post: Post }) {
  const stats: [string, number][] = [
    ["Views", post.views_count],
    ["Likes", post.likes_count],
    ["Comments", post.comments_count],
    ["Saves", post.bookmarks_count],
    ["Shares", post.shares_count],
  ];
  return (
    <div className="mx-4 mb-2 mt-1 flex justify-evenly rounded-2xl bg-surface-interactive py-3">
      {stats.map(([label, n]) => (
        <div key={label} className="flex flex-col items-center">
          <span className="text-sm font-bold text-fg">{formatCount(n)}</span>
          <span className="text-micro text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function OptionsSheet({
  post,
  isOwn,
  following,
  onClose,
  onFollow,
  onNotInterested,
  onDelete,
}: {
  post: Post;
  isOwn: boolean;
  following: boolean;
  onClose: () => void;
  onFollow: () => Promise<unknown>;
  onNotInterested: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const username = post.author?.username ?? "";
  const isListing = post.type === "listing" || !!post.listing;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div
        className="glass relative m-2.5 w-full max-w-sm rounded-floating p-1.5"
        style={{ marginBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        {confirming ? (
          <div className="p-4">
            <p className="text-base font-bold text-fg">Delete this {isListing ? "listing" : "post"}?</p>
            <p className="mt-1 text-sm text-muted">This can&apos;t be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-fg hover:bg-white/8">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(onDelete)}
                className="h-10 rounded-full px-4 text-sm font-semibold text-danger hover:bg-white/8 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : isOwn ? (
          <>
            <Insights post={post} />
            {isListing && <Tile icon="bag" label="View listing" href={`/l/${post.id}`} />}
            <Tile icon="trash" label={isListing ? "Delete listing" : "Delete post"} destructive onClick={() => setConfirming(true)} />
          </>
        ) : (
          <>
            {isListing && <Tile icon="bag" label="View product" href={`/l/${post.id}`} />}
            {username && (
              <Tile
                icon={following ? "check" : "plus"}
                label={following ? `Unfollow @${username}` : `Follow @${username}`}
                disabled={busy}
                onClick={() => void run(onFollow)}
              />
            )}
            <Tile icon="close" label="Not interested" onClick={onNotInterested} />
          </>
        )}
      </div>
    </div>
  );
}
