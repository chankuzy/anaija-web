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
const DEFAULT_CORNERS = "rounded-[20px]";

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Unavailable({ corners }: { corners: string }) {
  return (
    <div className={`flex w-[232px] max-w-full flex-col items-center gap-2 bg-card px-4 py-7 text-center ${corners}`}>
      <Icon name="eyeClosed" className="size-5 text-fg/60" />
      <p className="text-secondary font-semibold text-fg">Post unavailable</p>
      <p className="text-supporting text-muted">It may have been deleted or made private.</p>
    </div>
  );
}

function Card({ post, corners }: { post: SharedPost; corners: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const href = post.type === "listing" ? `/l/${post.id}` : `/p/${post.id}`;
  const video = post.is_video;
  const multi = !video && post.image_count >= MULTI_MIN;
  const showImage = !!post.image && !failed;

  return (
    <div
      className={`group/card relative w-[232px] max-w-full overflow-hidden bg-card shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-shadow duration-300 hover:shadow-[0_18px_44px_rgba(0,0,0,0.65)] ${corners} ${
        video ? "aspect-[9/14]" : "aspect-[4/5]"
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
          <Icon name={video ? "videocamera" : "gallery"} className="size-[34px] text-fg/25" />
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
        className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[72px]"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))" }}
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[132px]"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0))" }}
      />

      {/* Top-right: clapperboard for video/reels, copy for multi-image posts */}
      {(video || multi) && (
        <span className="pointer-events-none absolute right-3 top-3 z-[3] text-fg">
          <Icon name={video ? "clapperboard" : "copy"} filled className={`size-[19px] ${GLYPH_SHADOW}`} />
        </span>
      )}

      {/* Top-left: price on listings */}
      {post.price && (
        <span className="pointer-events-none absolute left-3 top-3 z-[3] rounded-full bg-brand px-2 py-[3px] text-[11px] font-extrabold text-brand-fg">
          ₦{post.price}
        </span>
      )}

      {/* Centre: play for video/reels */}
      {video && (
        <span className="pointer-events-none absolute inset-0 z-[3] grid place-items-center text-fg">
          <Icon
            name="play"
            filled
            className={`size-12 transition-transform duration-200 group-hover/card:scale-110 ${GLYPH_SHADOW}`}
          />
        </span>
      )}

      {/* Bottom-left: caption + author row */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex flex-col items-start gap-2 p-3">
        {post.caption && (
          <p className="text-shadow line-clamp-2 w-full text-[12px] font-medium leading-snug text-fg/95">{post.caption}</p>
        )}
        {post.author && (
          <Link
            href={`/u/${post.author}`}
            className="pointer-events-auto flex max-w-full items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Avatar url={post.author_avatar} name={post.author_name ?? post.author} size={22} />
            <span className="text-shadow truncate text-[11.5px] font-bold leading-none text-fg">{post.author}</span>
            {post.author_verified && <Icon name="verifiedCheck" filled className="size-3 shrink-0 text-sky-400" />}
          </Link>
        )}
      </div>

      {/* Bottom-right: duration */}
      {video && post.duration !== null && (
        <span className="text-shadow pointer-events-none absolute bottom-3.5 right-3 z-[3] text-[10px] font-bold leading-none tabular-nums text-fg">
          {clock(post.duration)}
        </span>
      )}
    </div>
  );
}

// `corners` comes from the chat bubble grouping (lone = fully round, stacked = sharp inner edge); other callers get round.
export function SharedPostCard({ post, corners = DEFAULT_CORNERS }: { post: SharedPost; corners?: string }) {
  return post.unavailable ? <Unavailable corners={corners} /> : <Card post={post} corners={corners} />;
}
