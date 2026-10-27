/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef } from "react";
import { usePlayback } from "@/components/feed/playback-context";
import { Icon } from "@/components/ui/icon";
import { formatDuration, frameAspect, isVideoMedia, sortedMedia } from "@/lib/feed/content";
import { setHomeMuted, useHomeMuted } from "@/lib/feed/home-sound";
import { sizedImage, useNetProfile } from "@/lib/feed/net";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

const notAllowed = (e: unknown) => (e as DOMException | undefined)?.name === "NotAllowedError";

// A reel in Home is a poster until it is the one being watched; then (and only then) a muted <video> exists.
// Tapping opens the Immersive feed on this same post. Data-saver connections never autoplay.
export function ReelBody({ post, index, active, paused, onOpen, onLike }: BodyProps) {
  const video = sortedMedia(post).find(isVideoMedia);
  const src = video?.url ?? post.video_url;
  const profile = useNetProfile();
  const rawPoster = video?.thumbnail ?? post.thumbnail_url;
  const poster = rawPoster ? sizedImage(rawPoster, profile) : undefined;
  const { autoplay, focused } = usePlayback();
  const muted = useHomeMuted();
  const ref = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const mounted = !!src && active && autoplay && profile !== "lite";
  const play = mounted && !paused && focused;
  const dur = formatDuration(post.duration ?? video?.duration);

  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = muted;
  }, [muted, mounted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!play) {
      el.pause();
      return;
    }
    const p = el.play();
    if (p)
      p.catch((e: unknown) => {
        if (!notAllowed(e) || el.muted) return; // only an autoplay-policy rejection means "retry muted"
        el.muted = true;
        setHomeMuted(true);
        el.play().catch(() => {});
      });
    return () => el.pause();
  }, [play, mounted]);

  // Real unmount: abort the download (isConnected is still true during strict-mode re-runs).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return () => {
      el.pause();
      if (!el.isConnected) {
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [mounted]);

  return (
    <div className="relative w-full overflow-hidden rounded-image bg-black" style={{ aspectRatio: frameAspect("reel", post), maxHeight: "82dvh" }}>
      <TapSurface onOpen={onOpen} onLike={onLike} label="Open reel" className="absolute inset-0">
        {mounted ? (
          <video
            ref={ref}
            src={src ?? undefined}
            poster={poster}
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (bar.current && v.duration) bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
            }}
            className="h-full w-full object-cover"
          />
        ) : poster ? (
          <img src={poster} alt="" decoding="async" loading={index < 2 ? "eager" : "lazy"} draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-white/35">
            <Icon name="clapperboard" filled className="size-10" />
          </span>
        )}
      </TapSurface>

      {!mounted && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-black/45 text-white">
            <Icon name="play" filled className="size-7" />
          </span>
        </span>
      )}
      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-black/55 py-1 pl-2 pr-2.5 text-micro font-semibold text-white">
        <Icon name="clapperboard" filled className="size-3.5" />
        {dur || "Reel"}
      </span>
      {mounted && (
        <>
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={!muted}
            onClick={() => setHomeMuted(!muted)}
            className="hit-area absolute bottom-4 right-3 grid size-9 place-items-center rounded-full bg-black/55 text-white transition-transform active:scale-90"
          >
            <Icon name={muted ? "volumeOff" : "volumeOn"} className="size-[18px]" />
          </button>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
            <span ref={bar} className="block h-full origin-left bg-white/90" style={{ transform: "scaleX(0)" }} />
          </span>
        </>
      )}
    </div>
  );
}
