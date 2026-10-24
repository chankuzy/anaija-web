/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { StorySource } from "@/lib/api/stories";

// Port of story_viewer_screen.dart's shared-post frame: a rounded card over a blurred backdrop, with the caption
// and hashtags INSIDE the frame and the price pill under them. Tap the card to pause and show "View post".

export interface FrameHold {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export const sourceHref = (s: StorySource) =>
  s.price !== null || s.type === "listing" ? `/listing/${s.post_id}` : `/p/${s.post_id}`;

// The story's own caption wins; otherwise the post's caption with any hashtags it doesn't already show.
export function frameCaption(own: string | null, src: StorySource): string {
  const mine = (own ?? "").trim();
  if (mine) return mine;
  const raw = (src.caption ?? "").trim();
  const have = new Set([...raw.matchAll(/#(\w+)/gu)].map((m) => m[1].toLowerCase()));
  const extra: string[] = [];
  for (const t of src.hashtags) {
    const c = t.replace(/#/g, "").trim();
    if (c && !have.has(c.toLowerCase())) {
      have.add(c.toLowerCase());
      extra.push(`#${c}`);
    }
  }
  if (extra.length === 0) return raw;
  return raw ? `${raw} ${extra.join(" ")}` : extra.join(" ");
}

function PricePill({ src, onOpen }: { src: StorySource; onOpen: () => void }) {
  const sold = src.status === "sold";
  const reserved = src.status === "reserved";
  const raw = src.price ?? "";
  const price = /^\d/.test(raw) ? `₦${raw}` : raw;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-extrabold ${
        sold ? "bg-white/25 text-white" : "bg-white text-black"
      }`}
    >
      {sold ? "Sold" : price}
      {reserved && <span className="text-[11px] font-bold opacity-60">Reserved</span>}
      {!sold && !reserved && src.price_type === "negotiable" && <span className="text-[11px] font-bold opacity-55">Nego</span>}
    </button>
  );
}

// Slideshow posts: crossfades through the images while active (paused with the story).
export function FrameSlides({
  urls,
  intervalMs,
  active,
  onReady,
}: {
  urls: string[];
  intervalMs: number;
  active: boolean;
  onReady: (ratio: number | null) => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || urls.length < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % urls.length), intervalMs);
    return () => window.clearInterval(t);
  }, [active, urls.length, intervalMs]);
  return (
    <>
      {urls.map((u, k) => (
        <img
          key={`${k}-${u}`}
          src={u}
          alt=""
          decoding="async"
          draggable={false}
          onLoad={
            k === 0
              ? (e) => onReady(e.currentTarget.naturalHeight > 0 ? e.currentTarget.naturalWidth / e.currentTarget.naturalHeight : null)
              : undefined
          }
          onError={k === 0 ? () => onReady(null) : undefined}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${k === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </>
  );
}

export function SourceFrame({
  ratio,
  src,
  caption,
  multi,
  tip,
  hold,
  onTap,
  onOpen,
  children,
}: {
  ratio: number;
  src: StorySource;
  caption: string;
  multi: boolean;
  tip: boolean;
  hold: FrameHold;
  onTap: () => void;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const parts = caption.split(/(#\w+)/u);
  const isListing = src.price !== null;
  // The wrapper never blocks the left/right tap zones; only the card itself takes clicks.
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center px-6"
      style={
        {
          containerType: "size",
          paddingTop: "calc(76px + env(safe-area-inset-top))",
          paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
        } as React.CSSProperties
      }
    >
      <div
        {...hold}
        onClick={onTap}
        className="pointer-events-auto relative cursor-pointer overflow-hidden rounded-[26px] bg-[#18181b] shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
        style={{ width: `min(100cqw, calc(100cqh * ${ratio}))`, aspectRatio: String(ratio) }}
      >
        {children}

        {multi && (
          <Icon name="copy" filled className="pointer-events-none absolute right-3 top-3 size-[18px] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]" />
        )}

        {(caption || isListing) && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-2.5 px-3.5 pb-3 pt-11"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.8))" }}
          >
            {caption && (
              <p className="text-shadow line-clamp-3 w-full text-[14px] font-medium leading-[1.3] text-white">
                {parts.map((p, i) =>
                  i % 2 === 1 ? (
                    <b key={i} className="font-extrabold">
                      {p}
                    </b>
                  ) : (
                    p
                  ),
                )}
              </p>
            )}
            {isListing && <PricePill src={src} onOpen={onOpen} />}
          </div>
        )}

        <div
          className={`absolute inset-0 grid place-items-center transition-opacity duration-150 ${
            tip ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex items-center gap-1 rounded-full bg-black/70 py-2.5 pl-[18px] pr-3.5 text-[14px] font-bold text-white"
          >
            View post
            <Icon name="chevronRight" weight="strong" className="size-4 text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
}
