"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Icon } from "@/components/ui/icon";
import { formatDuration } from "@/lib/messaging/use-voice-recorder";

// Global audio coordinator to ensure only one voice message plays at a time
let currentPlayingId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function setCurrentPlaying(id: string | null) {
  currentPlayingId = id;
  listeners.forEach((fn) => fn(id));
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
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Stop if another voice message starts playing
  useEffect(() => {
    const onActiveChange = (activeId: string | null) => {
      if (activeId !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlaying(false);
      }
    };
    listeners.add(onActiveChange);
    return () => {
      listeners.delete(onActiveChange);
    };
  }, [playerId]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = "metadata";
    audio.src = src;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      if (currentPlayingId === playerId) setCurrentPlaying(null);
    };

    const onError = () => {
      setLoading(false);
      setError(true);
      setPlaying(false);
      if (currentPlayingId === playerId) setCurrentPlaying(null);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
      audio.load();
      if (currentPlayingId === playerId) setCurrentPlaying(null);
    };
  }, [src, playerId]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || error) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (currentPlayingId === playerId) setCurrentPlaying(null);
    } else {
      setCurrentPlaying(playerId);
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          setPlaying(false);
          setError(true);
        });
    }
  }

  function cycleSpeed() {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-micro text-danger ${className}`}>
        <Icon name="dangerCircle" className="size-4 shrink-0" />
        <span>Voice message unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-[20px] p-2.5 select-none ${
        mine ? "text-brand-fg" : "text-fg"
      } ${className}`}
      style={{ minWidth: "210px", maxWidth: "280px" }}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={`grid size-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${
          mine
            ? "bg-brand-fg text-brand shadow-sm hover:opacity-90"
            : "bg-brand text-brand-fg shadow-sm hover:brightness-110"
        } disabled:opacity-50`}
      >
        <Icon name={playing ? "pause" : "play"} filled className="size-4 ml-[1px]" />
      </button>

      <div className="flex flex-1 flex-col justify-center min-w-0">
        <div className="relative flex items-center h-4">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Audio progress"
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/20 accent-current outline-none"
            style={{
              background: `linear-gradient(to right, currentColor ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-semibold opacity-75 mt-1">
          <span>{formatDuration(playing || currentTime > 0 ? currentTime : duration)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}x`}
            className="rounded px-1 text-[10px] font-extrabold tracking-tight opacity-90 hover:opacity-100 transition hover:bg-white/10"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}
