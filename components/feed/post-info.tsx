"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FollowPill } from "@/components/ui/follow-pill";
import { Icon } from "@/components/ui/icon";
import { timeAgo } from "@/lib/format";
import type { Post } from "@/lib/api/feed-types";

// Port of PostInfoBlock._fullText: hashtags not already in the caption get appended.
function fullCaption(caption: string | null, tags: string[]): string {
  const raw = (caption ?? "").trim();
  const have = new Set([...raw.matchAll(/#(\w+)/gu)].map((m) => m[1].toLowerCase()));
  const extra: string[] = [];
  for (const t of tags ?? []) {
    const c = t.replace(/#/g, "").trim();
    if (c && !have.has(c.toLowerCase())) {
      have.add(c.toLowerCase());
      extra.push(`#${c}`);
    }
  }
  if (!extra.length) return raw;
  return raw ? `${raw} ${extra.join(" ")}` : extra.join(" ");
}

function renderCaption(text: string) {
  return text
    .split(/(#\w+)/gu)
    .map((part, i) =>
      part.length > 1 && part.startsWith("#") ? (
        <span key={i} className="font-bold">
          {part}
        </span>
      ) : (
        part
      ),
    );
}

function Caption({
  text,
  expanded,
  onExpandedChange,
}: {
  text: string;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}) {
  const [overflows, setOverflows] = useState(false);
  // Measure via ResizeObserver (callback-driven, so no setState in an effect body).
  const measure = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (expanded) {
    return (
      <div>
        <div className="no-scrollbar text-shadow max-h-[34dvh] overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-[1.3] text-white">
          {renderCaption(text)}
        </div>
        <button
          type="button"
          onClick={() => onExpandedChange(false)}
          className="text-shadow pb-0.5 pt-2 text-[12.5px] font-bold text-white/70"
        >
          Show less
        </button>
      </div>
    );
  }

  return (
    <div className="text-shadow flex items-baseline gap-1 text-[13.5px] leading-[1.3] text-white">
      <span ref={measure} className="min-w-0 truncate">
        {renderCaption(text)}
      </span>
      {overflows && (
        <button type="button" onClick={() => onExpandedChange(true)} className="shrink-0 font-bold text-white/70">
          more
        </button>
      )}
    </div>
  );
}

// Port of FollowSlot: the pill only exists for people you don't follow. Right after you follow it
// confirms with "Following" for a moment, then folds away.
function FollowSlot({ following, onFollow }: { following: boolean; onFollow: () => Promise<boolean | null> }) {
  const [lingering, setLingering] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  if (following && !lingering) return null;
  return (
    <FollowPill
      following={following}
      onClick={() => {
        if (following) return;
        void onFollow().then((r) => {
          if (r === true) {
            setLingering(true);
            timer.current = window.setTimeout(() => setLingering(false), 1400);
          }
        });
      }}
    />
  );
}

export function PostInfo({
  post,
  expanded,
  onExpandedChange,
  isOwn,
  following,
  onFollow,
}: {
  post: Post;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  isOwn: boolean;
  following: boolean;
  onFollow: () => Promise<boolean | null>;
}) {
  const a = post.author;
  const d = post.listing;
  const caption = fullCaption(post.caption, post.hashtags);
  const music = (post.audio?.name ?? "").trim();
  const profileHref = a?.username ? `/u/${a.username}` : null;

  const who = (
    <>
      <span className="rounded-full border border-white/80 p-px">
        <Avatar url={a?.avatar} name={a?.name ?? a?.username} size={34} />
      </span>
      <span className="min-w-0">
        <span className="text-shadow block truncate text-[14.5px] font-bold text-white">{a?.username ?? ""}</span>
        <span className="block text-[11.5px] text-white/70">{timeAgo(post.created_at)}</span>
      </span>
    </>
  );

  return (
    <div className="flex flex-col items-start">
      {d && !expanded && (
        <Link
          href={`/listing/${post.id}`}
          className="mb-2 inline-flex items-center gap-2 rounded-[14px] border border-white/20 bg-white/12 py-2.5 pl-3.5 pr-2.5 backdrop-blur-[18px]"
        >
          <span className="text-white">
            <span className="text-[13px] font-bold text-white/75">₦</span>
            <span className="text-lg font-extrabold tracking-tight">{d.formatted_price}</span>
          </span>
          {d.price_type === "negotiable" && d.status !== "sold" && (
            <span className="rounded-full bg-warm/12 px-1.5 py-0.5 text-[11px] font-bold text-warm">Nego</span>
          )}
          {(d.status === "sold" || d.status === "reserved") && (
            <span className="text-xs font-bold text-white/70">{d.status === "sold" ? "Sold" : "Reserved"}</span>
          )}
          <Icon name="chevronRight" className="size-5 text-white/70" />
        </Link>
      )}

      <div className="flex w-full items-center gap-2.5">
        {profileHref ? (
          <Link href={profileHref} className="flex min-w-0 flex-1 items-center gap-2.5">
            {who}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">{who}</div>
        )}
        {a && !isOwn && <FollowSlot following={following} onFollow={onFollow} />}
      </div>

      {caption && (
        <div className="mt-2 w-full">
          <Caption text={caption} expanded={expanded} onExpandedChange={onExpandedChange} />
        </div>
      )}

      {music && !expanded && (
        <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-white/10 bg-black/35 px-[11px] py-1 text-[11.5px] font-medium text-white">
          <Icon name="music" className="size-3 shrink-0" />
          <span className="truncate">{music}</span>
        </span>
      )}
    </div>
  );
}
