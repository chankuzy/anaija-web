/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePlayback } from "@/components/feed/playback-context";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { isImageMedia, sortedMedia } from "@/lib/feed/content";
import { sizedImage, useNetProfile } from "@/lib/feed/net";
import { TapSurface } from "./tap-surface";

export interface Slide {
  id: number | string;
  url: string | null;
  color: string | null;
}

export function slidesOf(post: Post): Slide[] {
  const imgs = sortedMedia(post)
    .filter(isImageMedia)
    .map((m) => ({ id: m.id, url: m.url ?? m.thumbnail, color: m.dominant_color }));
  if (imgs.length) return imgs;
  return post.thumbnail_url ? [{ id: "thumb", url: post.thumbnail_url, color: null }] : [];
}

const HOLD_MS = 6000; // after the viewer touches the carousel, auto-slide waits this long
const RM = "(prefers-reduced-motion: reduce)";
const cssColor = (c: string | null) => (!c ? "#19191d" : /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : c);

export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(RM);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(RM).matches,
    () => false,
  );
}

function SlideImg({ s, load, eager, hidden }: { s: Slide; load: boolean; eager: boolean; hidden?: boolean }) {
  const profile = useNetProfile();
  const [ready, setReady] = useState(false);
  const src = s.url ? sizedImage(s.url, profile) : null;
  return (
    <div
      aria-hidden={hidden || undefined}
      className="relative h-full w-full shrink-0 snap-center"
      style={{ backgroundColor: cssColor(s.color) }}
    >
      {load && src && (
        <img
          src={src}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "low"}
          draggable={false}
          onLoad={() => setReady(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

// Swipeable images that slide by themselves while this post is the one being looked at. A trailing copy of the
// first slide makes the loop seamless (it snaps back to the real first slide once the copy settles).
export function ImageCarousel({
  slides,
  aspect,
  index,
  active,
  paused,
  intervalMs = 3600,
  onOpen,
  onLike,
  label,
  children,
}: {
  slides: Slide[];
  aspect: number;
  index: number;
  active: boolean;
  paused: boolean;
  intervalMs?: number;
  onOpen: () => void;
  onLike: () => void;
  label: string;
  children?: ReactNode;
}) {
  const { focused } = usePlayback();
  const reduced = useReducedMotion();
  const n = slides.length;
  const multi = n > 1;
  const list = multi ? [...slides, slides[0]] : slides;
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0); // 0..n, where n is the trailing copy
  const holdUntil = useRef(0);
  const hovering = useRef(false);
  const settle = useRef<number | null>(null);
  const running = active && !paused && focused && multi && !reduced;
  const shown = multi ? idx % n : 0;

  useEffect(
    () => () => {
      if (settle.current !== null) window.clearTimeout(settle.current);
    },
    [],
  );

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      const el = ref.current;
      if (!el?.clientWidth || hovering.current || Date.now() < holdUntil.current) return;
      let cur = Math.round(el.scrollLeft / el.clientWidth);
      if (cur >= n) {
        el.scrollLeft = 0;
        cur = 0;
      }
      el.scrollTo({ left: (cur + 1) * el.clientWidth, behavior: "smooth" });
    }, Math.max(1500, intervalMs));
    return () => window.clearInterval(t);
  }, [running, n, intervalMs]);

  function onScroll() {
    const el = ref.current;
    if (!el?.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx((p) => (p === i ? p : i));
    if (settle.current !== null) window.clearTimeout(settle.current);
    if (multi && i >= n) {
      settle.current = window.setTimeout(() => {
        settle.current = null;
        if (ref.current) ref.current.scrollLeft = 0;
        setIdx(0);
      }, 120);
    }
  }
  function go(d: number) {
    holdUntil.current = Date.now() + HOLD_MS;
    const el = ref.current;
    if (el) el.scrollBy({ left: d * el.clientWidth, behavior: "smooth" });
  }
  const bump = () => {
    holdUntil.current = Date.now() + HOLD_MS;
  };
  const arrow = "absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white md:grid";

  return (
    <div
      role="group"
      aria-roledescription={multi ? "carousel" : undefined}
      className="relative overflow-hidden rounded-image bg-surface-subtle"
      style={{ aspectRatio: aspect }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") hovering.current = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hovering.current = false;
      }}
      onPointerDown={bump}
      onWheel={bump}
      onFocus={bump}
      onKeyDown={bump}
    >
      <TapSurface onOpen={onOpen} onLike={onLike} label={label} className="absolute inset-0">
        <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {list.map((s, i) => (
            <SlideImg
              key={i === n && multi ? `${s.id}-loop` : s.id}
              s={s}
              load={i === 0 || Math.abs(i - idx) <= 1}
              eager={index < 2 && i === 0}
              hidden={multi && i === n}
            />
          ))}
        </div>
      </TapSurface>

      {multi && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="flex gap-1 rounded-pill bg-black/35 px-2 py-1.5">
              {slides.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-[5px] rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${
                    i === shown ? "w-4 bg-white" : "w-[5px] bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
          {idx > 0 && idx < n && (
            <button type="button" aria-label="Previous image" onClick={() => go(-1)} className={`${arrow} left-2`}>
              <Icon name="chevronRight" className="size-5 rotate-180" />
            </button>
          )}
          <button type="button" aria-label="Next image" onClick={() => go(1)} className={`${arrow} right-2`}>
            <Icon name="chevronRight" className="size-5" />
          </button>
        </>
      )}
      {children}
    </div>
  );
}
