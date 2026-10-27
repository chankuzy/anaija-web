/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { frameAspect, isImageMedia, sortedMedia } from "@/lib/feed/content";
import { sizedImage, useNetProfile } from "@/lib/feed/net";
import type { FeedMedia } from "@/lib/api/feed-types";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

const cssColor = (c: string | null) => (!c ? "#19191d" : /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : c);

function Frame({ m, load, eager }: { m: FeedMedia; load: boolean; eager: boolean }) {
  const profile = useNetProfile();
  const raw = m.url ?? m.thumbnail;
  const src = raw ? sizedImage(raw, profile) : null;
  return (
    <div className="relative h-full w-full shrink-0 snap-center" style={{ backgroundColor: cssColor(m.dominant_color) }}>
      {load && src && (
        <img
          src={src}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "low"}
          draggable={false}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

// One image or a swipeable set. Only the visible image and its neighbours are fetched.
export function GalleryBody({ post, index, onOpen, onLike }: BodyProps) {
  const images = sortedMedia(post).filter(isImageMedia);
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const multi = images.length > 1;

  function onScroll() {
    const el = ref.current;
    if (!el?.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx((p) => (p === i ? p : i));
  }
  function go(d: number) {
    ref.current?.scrollBy({ left: d * (ref.current?.clientWidth ?? 0), behavior: "smooth" });
  }
  const arrow = "absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white md:grid";

  return (
    <div className="relative overflow-hidden rounded-image bg-surface-subtle" style={{ aspectRatio: frameAspect("gallery", post) }}>
      <TapSurface onOpen={onOpen} onLike={onLike} label="Open post" className="absolute inset-0">
        <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {images.map((m, i) => (
            <Frame key={m.id} m={m} load={i === 0 || Math.abs(i - idx) <= 1} eager={index < 2 && i === 0} />
          ))}
        </div>
      </TapSurface>
      {multi && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-pill bg-black/55 px-2.5 py-1 text-micro font-semibold tabular-nums text-white">
            {idx + 1}/{images.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1">
            {images.map((m, i) => (
              <span
                key={m.id}
                className={`h-[5px] rounded-full transition-all duration-150 motion-reduce:transition-none ${i === idx ? "w-4 bg-white" : "w-[5px] bg-white/45"}`}
              />
            ))}
          </div>
          {idx > 0 && (
            <button type="button" aria-label="Previous image" onClick={() => go(-1)} className={`${arrow} left-2`}>
              <Icon name="chevronRight" className="size-5 rotate-180" />
            </button>
          )}
          {idx < images.length - 1 && (
            <button type="button" aria-label="Next image" onClick={() => go(1)} className={`${arrow} right-2`}>
              <Icon name="chevronRight" className="size-5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
