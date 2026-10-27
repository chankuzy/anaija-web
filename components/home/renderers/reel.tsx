/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef } from "react";
import { usePlayback } from "@/components/feed/playback-context";
import { Icon } from "@/components/ui/icon";
import { formatDuration, frameAspect, isVideoMedia, sortedMedia } from "@/lib/feed/content";
import { sizedImage, useNetProfile } from "@/lib/feed/net";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

const notAllowed = (e: unknown) => (e as DOMException | undefined)?.name === "NotAllowedError";

// A reel in Home is a poster until it is the one being watched; then (and only then) a muted-by-default <video>
// exists. Tapping opens the Immersive feed on this same post. Data-saver connections never autoplay.
export function ReelBody({ post, index, active, paused, onOpen, onLike }: BodyProps) {
  const video = sortedMedia(post).find(isVideoMedia);
  const src = video?.url ?? post.video_url;
  const profile = useNetProfile();
  const rawPoster = video?.thumbnail ?? post.thumbnail_url;
  const poster = rawPoster ? sizedImage(rawPoster, profile) : undefined;
  const { muted, autoplay, forceMute, toggleMute, focused } = usePlayback();
  const ref = useRef<HTMLVideoElement>(null);
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
        forceMute();
        el.play().catch(() => {});
      });
    return () => el.pause();
  }, [play, mounted, forceMute]);

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
    <div
      className="relative w-full overflow-hidden rounded-image bg-black"
      style={{ aspectRatio: frameAspect("reel", post), maxHeight: "82dvh" }}
    >
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
            className="h-full w-full object-cover"
          />
        ) : poster ? (
          <img
            src={poster}
            alt=""
            decoding="async"
            loading={index < 2 ? "eager" : "lazy"}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-white/35">
            <Icon name="clapperboard" filled className="size-10" />
          </span>
        )}
      </TapSurface>
      <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-pill bg-black/55 py-1 pl-2 pr-2.5 text-micro font-semibold text-white">
        <Icon name="clapperboard" filled className="size-3.5" />
        {dur || "Reel"}
      </span>
      {mounted && (
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={toggleMute}
          className="hit-area absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-black/55 text-white"
        >
          <Icon name={muted ? "volumeOff" : "volumeOn"} className="size-[18px]" />
        </button>
      )}
    </div>
  );
}
