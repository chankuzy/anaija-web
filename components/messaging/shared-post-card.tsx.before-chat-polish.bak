/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { MULTI_MIN } from "@/components/ui/multi-badge";
import type { SharedPost } from "@/lib/api/messaging";

// Bare glyphs only: no pill, no circle, no backdrop. Legibility comes from the scrims and this shadow.
const GLYPH_SHADOW = "drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]";

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Unavailable() {
  return (
    <div className="mb-1 flex w-56 flex-col items-center gap-2 rounded-[22px] border border-line bg-card px-5 py-8 text-center">
      <Icon name="eyeClosed" className="size-6 text-white/60" />
      <p className="text-secondary font-semibold text-fg">Post unavailable</p>
      <p className="text-supporting text-muted">It may have been deleted or made private.</p>
    </div>
  );
}

function Card({ post }: { post: SharedPost }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const href = post.type === "listing" ? `/listing/${post.id}` : `/p/${post.id}`;
  const video = post.is_video;
  const multi = !video && post.image_count >= MULTI_MIN;
  const showImage = !!post.image && !failed;

  return (
    <div
      className={`group/card relative mb-1 w-56 overflow-hidden rounded-[22px] bg-card shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-shadow duration-300 hover:shadow-[0_18px_44px_rgba(0,0,0,0.65)] ${
        video ? "aspect-[9/15]" : "aspect-[4/5]"
      }`}
    >
      {/* Media */}
      {showImage ? (
        <>
          {!loaded && <span aria-hidden="true" className="sk-block absolute inset-0" />}
          <img
            ref={(el) => {
              if (el?.complete && el.naturalWidth > 0) setLoaded(true);
            }}
            src={post.image ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover/card:scale-[1.04] ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ background: "linear-gradient(160deg,#1d1d24 0%,#0b0b0f 100%)" }}
        >
          <Icon name={video ? "videocamera" : "gallery"} className="size-10 text-white/25" />
        </div>
      )}

      {/* Whole-card tap target (author link sits above it) */}
      <Link
        href={href}
        aria-label={post.caption ? `Open post: ${post.caption}` : "Open post"}
        className="absolute inset-0 z-[1] outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-white"
      />

      {/* Scrims */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-20"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))" }}
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-32"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))" }}
      />

      {/* Top-right: clapperboard for video/reels, copy for multi-image posts */}
      {(video || multi) && (
        <span className="pointer-events-none absolute right-3 top-3 z-[3] text-white">
          <Icon name={video ? "clapperboard" : "copy"} filled className={`size-[22px] ${GLYPH_SHADOW}`} />
        </span>
      )}

      {/* Top-left: price on listings */}
      {post.price && (
        <span className="pointer-events-none absolute left-3 top-3 z-[3] rounded-full bg-white px-2.5 py-1 text-supporting font-extrabold text-black">
          ₦{post.price}
        </span>
      )}

      {/* Centre: play for video/reels */}
      {video && (
        <span className="pointer-events-none absolute inset-0 z-[3] grid place-items-center text-white">
          <Icon
            name="play"
            filled
            className={`size-14 transition-transform duration-200 group-hover/card:scale-110 ${GLYPH_SHADOW}`}
          />
        </span>
      )}

      {/* Bottom-left: caption + author row */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex flex-col items-start gap-2 p-3">
        {post.caption && (
          <p className="text-shadow w-full truncate text-[12.5px] font-medium leading-none text-white/90">{post.caption}</p>
        )}
        {post.author && (
          <Link
            href={`/u/${post.author}`}
            className="pointer-events-auto flex max-w-full items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Avatar url={post.author_avatar} name={post.author_name ?? post.author} size={26} className="ring-2 ring-white/80" />
            <span className="text-shadow truncate text-[13px] font-bold leading-none text-white">{post.author}</span>
            {post.author_verified && <Icon name="verifiedCheck" filled className="size-3.5 shrink-0 text-sky-400" />}
          </Link>
        )}
      </div>

      {/* Bottom-right: duration */}
      {video && post.duration !== null && (
        <span className="text-shadow pointer-events-none absolute bottom-3.5 right-3 z-[3] text-[11.5px] font-bold leading-none tabular-nums text-white">
          {clock(post.duration)}
        </span>
      )}
    </div>
  );
}

export function SharedPostCard({ post }: { post: SharedPost }) {
  return post.unavailable ? <Unavailable /> : <Card post={post} />;
}
