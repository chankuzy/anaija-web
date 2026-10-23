/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { FeedMedia, Post, PostAudio } from "@/lib/api/feed-types";
import { sizedImage, useNetProfile, type Warm } from "@/lib/feed/net";
import { usePlayback } from "./playback-context";

const isVideo = (m: FeedMedia) => (m.type ?? "").toLowerCase() === "video";
const isImage = (m: FeedMedia) => ["image", "photo", "picture"].includes((m.type ?? "").toLowerCase());
const cssColor = (c: string | null) => (!c ? "#0a0a0a" : /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : c);
const notAllowed = (e: unknown) => (e as DOMException | undefined)?.name === "NotAllowedError";

function Dots({ count, index }: { count: number; index: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[58px] z-10 xl:top-3 flex justify-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-[5px] rounded-full transition-all duration-150 ${i === index ? "w-4 bg-white" : "w-[5px] bg-white/40"}`}
        />
      ))}
    </div>
  );
}

// The dominant colour paints instantly; the image only downloads when `load` is true.
function Letterbox({ m, load, priority = false }: { m: FeedMedia; load: boolean; priority?: boolean }) {
  const profile = useNetProfile();
  const raw = m.url ?? m.thumbnail;
  const src = raw ? sizedImage(raw, profile) : null;
  return (
    <div className="absolute inset-0" style={{ backgroundColor: cssColor(m.dominant_color) }}>
      {load && src && (
        <img
          src={src}
          alt=""
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          draggable={false}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

function Carousel({ images, near, current }: { images: FeedMedia[]; near: boolean; current: boolean }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx((p) => (p === i ? p : i));
  }
  function go(d: number) {
    const el = ref.current;
    if (el) el.scrollBy({ left: d * el.clientWidth, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white md:grid";
  return (
    <div className="absolute inset-0">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {images.map((m, i) => (
          <div key={m.id} className="relative h-full w-full shrink-0 snap-center">
            {/* Posts not on screen only fetch their first image; the visible one fetches its neighbours. */}
            <Letterbox
              m={m}
              load={near && (i === 0 || (current && Math.abs(i - idx) <= 1))}
              priority={current && i === idx}
            />
          </div>
        ))}
      </div>
      <Dots count={images.length} index={idx} />
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
    </div>
  );
}

function Slideshow({
  images,
  intervalMs,
  running,
  current,
  near,
}: {
  images: FeedMedia[];
  intervalMs: number;
  running: boolean; // timer on: current post, nothing open over it, window focused
  current: boolean;
  near: boolean;
}) {
  const [s, setS] = useState({ idx: 0, loaded: 2 });
  const len = images.length;

  useEffect(() => {
    if (!running || len < 2) return;
    const t = window.setInterval(() => {
      setS((p) => {
        const n = (p.idx + 1) % len;
        return { idx: n, loaded: Math.min(len, Math.max(p.loaded, n + 2)) };
      });
    }, Math.max(800, intervalMs));
    return () => window.clearInterval(t);
  }, [running, len, intervalMs]);

  return (
    <div className="absolute inset-0">
      {images.map((m, i) => (
        <div
          key={m.id}
          className={`absolute inset-0 transition-opacity duration-500 ${i === s.idx ? "opacity-100" : "opacity-0"}`}
        >
          <Letterbox m={m} load={near && (i === 0 || (current && i < s.loaded))} priority={current && i === s.idx} />
        </div>
      ))}
      <Dots count={len} index={s.idx} />
    </div>
  );
}

// Audio plays only when: this is the current post, nothing is open over it, the window is focused, and the
// viewer is unmuted. While muted it is not even downloaded.
function PostAudioPlayer({ audio, play, buffer }: { audio: PostAudio; play: boolean; buffer: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const { muted, forceMute } = usePlayback();
  const start = (audio.start_ms ?? 0) / 1000;
  const windowMs = audio.playback_duration_ms ?? audio.duration_ms ?? 0;
  const end = windowMs > 0 ? start + windowMs / 1000 : null;

  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!play) {
      el.pause();
      return;
    }
    const seek = () => {
      try {
        el.currentTime = start;
      } catch {
        /* metadata not ready */
      }
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener("loadedmetadata", seek, { once: true });
    const p = el.play();
    if (p)
      p.catch((e: unknown) => {
        if (notAllowed(e)) forceMute(); // autoplay policy: stay silent rather than fight the browser
      });
    const onTime = () => {
      if (end !== null && el.currentTime >= end) el.currentTime = start;
    };
    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", seek);
      el.pause();
    };
  }, [play, start, end, forceMute]);

  // Real unmount: abort the download. (isConnected is still true during strict-mode / Activity re-runs.)
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
  }, []);

  return (
    <audio ref={ref} src={audio.url ?? undefined} preload={play || buffer ? "auto" : "metadata"} loop muted />
  );
}

function VideoMedia({
  post,
  video,
  active,
  near,
  warm,
  paused,
}: {
  post: Post;
  video: FeedMedia;
  active: boolean;
  near: boolean;
  warm?: Warm;
  paused: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const { muted, autoplay, forceMute, focused } = usePlayback();
  const profile = useNetProfile();
  const [manual, setManual] = useState<"play" | "pause" | null>(null);
  const src = video.url ?? post.video_url;
  const rawPoster = video.thumbnail ?? post.thumbnail_url;
  const poster = rawPoster ? sizedImage(rawPoster, profile) : undefined;
  // The <video> element (and its network use) exists only for the current post and, when the profile
  // allows, the next one. Everything else shows the poster image.
  const mounted = !!src && (active || !!warm);
  const play = active && !paused && focused && (manual === "play" || (manual === null && autoplay));
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });

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
        // Only an autoplay-policy rejection means "retry muted"; an AbortError from our own pause is not one.
        if (!notAllowed(e) || el.muted) return;
        el.muted = true;
        forceMute();
        el.play().catch(() => {});
      });
    return () => el.pause();
  }, [play, mounted, forceMute]);

  // Real unmount: abort the download. (isConnected is still true during strict-mode / Activity re-runs.)
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

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // Single click toggles play/pause; a double click (like) cancels the pending toggle.
  function onClick() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setManual(playRef.current ? "pause" : "play");
    }, 250);
  }

  return (
    <div className="absolute inset-0 bg-black" onClick={onClick}>
      {mounted ? (
        <video
          ref={ref}
          src={src ?? undefined}
          poster={poster}
          muted
          loop
          playsInline
          disablePictureInPicture
          preload={active || warm === "buffer" ? "auto" : "metadata"}
          className="h-full w-full object-contain"
        />
      ) : near && poster ? (
        <img src={poster} alt="" decoding="async" fetchPriority="low" className="h-full w-full object-contain" />
      ) : null}
      {active && !paused && focused && !play && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-16 place-items-center rounded-full bg-black/45 text-white">
            <Icon name="play" filled className="size-8" />
          </span>
        </div>
      )}
    </div>
  );
}

export function postHasVideo(post: Post) {
  return post.media.some(isVideo);
}

export function PostMedia({
  post,
  active,
  near,
  paused,
  warm,
}: {
  post: Post;
  active: boolean;
  near: boolean;
  paused: boolean;
  warm?: Warm;
}) {
  const { focused, muted } = usePlayback();
  const media = [...post.media].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const video = media.find(isVideo);
  if (video) return <VideoMedia post={post} video={video} active={active} near={near} warm={warm} paused={paused} />;

  const images = media.filter(isImage);
  const audio = post.audio?.enabled && post.audio.url ? post.audio : null;
  const playAudio = active && !paused && focused && !muted;
  const bufferAudio = warm === "buffer" && !muted;

  let body;
  if (images.length === 0) body = <div className="absolute inset-0 bg-card" />;
  else if (images.length === 1) body = <Letterbox m={images[0]} load={near} priority={active} />;
  else if (post.slideshow?.enabled)
    body = (
      <Slideshow
        images={images}
        intervalMs={post.slideshow.interval_ms}
        running={active && !paused && focused}
        current={active}
        near={near}
      />
    );
  else body = <Carousel images={images} near={near} current={active} />;

  return (
    <>
      {body}
      {audio && (active || bufferAudio) && <PostAudioPlayer audio={audio} play={playAudio} buffer={bufferAudio} />}
    </>
  );
}
