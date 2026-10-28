"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { formatDuration } from "@/lib/messaging/use-voice-recorder";

// Only one voice message plays at a time.
let activeId: string | null = null;
const subs = new Set<(id: string | null) => void>();
function claim(id: string | null) {
  activeId = id;
  subs.forEach((fn) => fn(id));
}

// Decorative waveform: a fixed, pleasant envelope shared by every message (not decoded from the audio).
const BARS = (() => {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(Math.round(6 + (((h >>> 0) % 1000) / 1000) * 14));
  }
  return out;
})();

function Bars() {
  return (
    <div className="flex h-full items-center justify-between">
      {BARS.map((h, i) => (
        <span key={i} className="w-[3px] shrink-0 rounded-full bg-current" style={{ height: h }} />
      ))}
    </div>
  );
}

export function VoicePlayer({
  src,
  mine,
  className = "",
}: {
  src: string;
  mine: boolean;
  className?: string;
}) {
  const id = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const durRef = useRef(0);
  const speedRef = useRef<1 | 1.5 | 2>(1);
  const dragging = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [nonce, setNonce] = useState(0);

  // New source: reset during render instead of inside the effect.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setLoading(true);
    setError(false);
    setPlaying(false);
  }

  // Progress and the time label are written straight to the DOM, so playback never re-renders the bubble.
  const paint = useCallback((t: number) => {
    const d = durRef.current;
    const r = d > 0 ? Math.min(1, t / d) : 0;
    if (fillRef.current) fillRef.current.style.clipPath = `inset(0 ${(1 - r) * 100}% 0 0)`;
    if (labelRef.current) labelRef.current.textContent = formatDuration(t > 0.05 ? t : d);
    trackRef.current?.setAttribute("aria-valuenow", String(Math.round(t)));
  }, []);

  useEffect(() => {
    const onActive = (other: string | null) => {
      const a = audioRef.current;
      if (other !== id && a && !a.paused) a.pause();
    };
    subs.add(onActive);
    return () => {
      subs.delete(onActive);
    };
  }, [id]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = "metadata";
    durRef.current = 0;
    paint(0);

    const ac = new AbortController();
    const o = { signal: ac.signal };
    let fixing = false;
    let frame = 0;

    const readDur = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        durRef.current = d;
        return true;
      }
      return false;
    };
    const tick = () => {
      paint(audio.currentTime);
      if (!audio.paused) frame = requestAnimationFrame(tick);
    };

    // Chrome reports Infinity for MediaRecorder webm. Seeking far past the end forces it to compute the real length.
    const onMeta = () => {
      if (readDur()) {
        setLoading(false);
        paint(audio.currentTime);
      } else {
        fixing = true;
        try {
          audio.currentTime = 1e101;
        } catch {}
      }
    };
    const onFix = () => {
      if (fixing && readDur()) {
        fixing = false;
        audio.currentTime = 0;
        setLoading(false);
        paint(0);
      }
    };

    audio.addEventListener("loadedmetadata", onMeta, o);
    audio.addEventListener("durationchange", onFix, o);
    audio.addEventListener("timeupdate", onFix, o);
    audio.addEventListener(
      "play",
      () => {
        setPlaying(true);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(tick);
      },
      o,
    );
    audio.addEventListener(
      "pause",
      () => {
        setPlaying(false);
        cancelAnimationFrame(frame);
        paint(audio.currentTime);
      },
      o,
    );
    audio.addEventListener(
      "ended",
      () => {
        audio.currentTime = 0;
        paint(0);
        setPlaying(false);
        if (activeId === id) claim(null);
      },
      o,
    );
    audio.addEventListener(
      "error",
      () => {
        setError(true);
        setLoading(false);
        setPlaying(false);
      },
      o,
    );

    // Never leave the button disabled forever if the browser can't work out a duration.
    const giveUp = window.setTimeout(() => setLoading(false), 3000);
    audio.src = src;

    return () => {
      window.clearTimeout(giveUp);
      cancelAnimationFrame(frame);
      ac.abort();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      if (activeId === id) claim(null);
    };
  }, [src, nonce, id, paint]);

  function toggle() {
    const a = audioRef.current;
    if (!a || error) return;
    if (a.paused) {
      claim(id);
      a.playbackRate = speedRef.current;
      a.play().catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "NotAllowedError")) setError(true);
      });
    } else {
      a.pause();
      if (activeId === id) claim(null);
    }
  }

  function cycleSpeed() {
    const next = speedRef.current === 1 ? 1.5 : speedRef.current === 1.5 ? 2 : 1;
    speedRef.current = next;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function seekTo(clientX: number) {
    const a = audioRef.current;
    const el = trackRef.current;
    if (!a || !el || durRef.current <= 0) return;
    const rect = el.getBoundingClientRect();
    const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = r * durRef.current;
    paint(a.currentTime);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const a = audioRef.current;
    if (!a) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      a.currentTime = Math.max(0, Math.min(durRef.current, a.currentTime + (e.key === "ArrowRight" ? 5 : -5)));
      paint(a.currentTime);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(false);
          setLoading(true);
          setNonce((n) => n + 1);
        }}
        className={`flex items-center gap-2 px-2.5 py-2 text-[12.5px] font-medium ${
          mine ? "text-brand-fg" : "text-danger"
        } ${className}`}
      >
        <Icon name="refresh" className="size-4 shrink-0" />
        <span>Couldn’t load · Tap to retry</span>
      </button>
    );
  }

  return (
    <div
      className={`flex w-[220px] max-w-full select-none items-center gap-2.5 px-1.5 py-1 ${
        mine ? "text-brand-fg" : "text-fg"
      } ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={`grid size-8 shrink-0 place-items-center rounded-full transition active:scale-95 disabled:opacity-50 ${
          mine ? "bg-brand-fg text-brand" : "bg-brand text-brand-fg"
        }`}
      >
        {loading ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Icon name={playing ? "pause" : "play"} filled className="ml-[1px] size-3.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek voice message"
          aria-valuemin={0}
          aria-valuenow={0}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging.current) seekTo(e.clientX);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          className="relative h-6 cursor-pointer touch-pan-y rounded outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          <div className="absolute inset-0 opacity-35">
            <Bars />
          </div>
          <div
            ref={fillRef}
            className="absolute inset-0"
            style={{ clipPath: "inset(0 100% 0 0)" }}
          >
            <Bars />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between text-[11px] font-semibold tabular-nums opacity-80">
          <span ref={labelRef}>0:00</span>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}x`}
            className="rounded-full bg-white/10 px-1.5 py-[1px] text-[10px] font-extrabold transition hover:bg-white/20 active:scale-95"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}
