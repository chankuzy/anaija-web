"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  formatDuration,
  useVoiceRecorder,
  type VoiceRecordingResult,
} from "@/lib/messaging/use-voice-recorder";

export function VoiceRecorderBar({
  recorder,
  onSend,
  onCancel,
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  onSend: (result: VoiceRecordingResult) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    status,
    duration,
    levels,
    error,
    uploadError,
    progress,
    previewUrl,
    pause,
    resume,
    stop,
    discard,
    finish,
    uploadAndGetResult,
  } = recorder;

  const [playing, setPlaying] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [sending, setSending] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const durRef = useRef(duration);
  const busy = useRef(false);

  useEffect(() => {
    durRef.current = duration;
  }, [duration]);

  useEffect(() => {
    if (!previewUrl) return;
    const a = new Audio(previewUrl);
    audioRef.current = a;
    const ac = new AbortController();
    const o = { signal: ac.signal };
    a.addEventListener("play", () => setPlaying(true), o);
    a.addEventListener("pause", () => setPlaying(false), o);
    a.addEventListener(
      "timeupdate",
      () => {
        const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : durRef.current;
        setRatio(total > 0 ? Math.min(1, a.currentTime / total) : 0);
      },
      o,
    );
    a.addEventListener(
      "ended",
      () => {
        setPlaying(false);
        setRatio(0);
      },
      o,
    );
    return () => {
      ac.abort();
      a.pause();
      a.removeAttribute("src");
      audioRef.current = null;
    };
  }, [previewUrl]);

  function togglePreview() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }

  async function handleSend() {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const res = await uploadAndGetResult();
      if (!res) return;
      // Fire and forget: the message shows up as "Sending…" and can be retried from the thread.
      void onSend(res);
      finish();
    } catch {
      // The upload error is shown inline and the recording is kept for another try.
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  function handleDiscard() {
    discard();
    onCancel();
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[24px] bg-surface-subtle p-3 px-4">
        <div className="flex items-center gap-2 text-[13.5px] text-danger">
          <Icon name="dangerCircle" className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="rounded-full bg-surface-interactive px-3 py-1 text-micro font-bold text-fg hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const uploading = status === "uploading";

  return (
    <div>
      {uploadError && (
        <p role="alert" className="mb-2 px-2 text-[12px] font-medium text-danger">
          {uploadError}
        </p>
      )}
      <div className="flex items-center gap-2 rounded-[26px] bg-surface-subtle p-1.5 px-2">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={sending}
          aria-label="Discard recording"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-danger active:scale-95 disabled:opacity-40"
        >
          <Icon name="trash" className="size-5" />
        </button>

        <div className="flex w-[52px] shrink-0 items-center gap-1.5">
          {status === "recording" && (
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-danger" />
          )}
          <span className="text-[13px] font-bold tabular-nums text-fg">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="flex h-8 min-w-0 flex-1 items-center justify-center overflow-hidden">
          {status === "preview" || uploading ? (
            <div className="flex w-full items-center gap-2">
              {status === "preview" && (
                <button
                  type="button"
                  onClick={togglePreview}
                  aria-label={playing ? "Pause preview" : "Play preview"}
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-fg transition hover:bg-white/15 active:scale-95"
                >
                  <Icon name={playing ? "pause" : "play"} filled className="size-3.5" />
                </button>
              )}
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200 ease-linear"
                  style={{ width: `${(uploading ? progress : ratio) * 100}%` }}
                />
              </div>
              {uploading && (
                <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted">
                  {Math.round(progress * 100)}%
                </span>
              )}
            </div>
          ) : status === "requesting" ? (
            <span className="text-[13px] text-muted">Allow microphone access…</span>
          ) : (
            <div className="flex h-full items-center gap-[3px]">
              {levels.map((h, i) => (
                <span
                  key={i}
                  className={`w-[3px] shrink-0 rounded-full transition-[height] duration-100 ease-out ${
                    status === "recording" ? "bg-brand" : "bg-muted"
                  }`}
                  style={{ height: h }}
                />
              ))}
            </div>
          )}
        </div>

        {status === "recording" && (
          <button
            type="button"
            onClick={pause}
            aria-label="Pause recording"
            className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition hover:bg-white/10 active:scale-95"
          >
            <Icon name="pause" className="size-5" />
          </button>
        )}

        {status === "paused" && (
          <>
            <button
              type="button"
              onClick={resume}
              aria-label="Resume recording"
              className="grid size-9 shrink-0 place-items-center rounded-full text-brand transition hover:bg-white/10 active:scale-95"
            >
              <Icon name="microphone" filled className="size-5" />
            </button>
            <button
              type="button"
              onClick={stop}
              aria-label="Review recording"
              className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition hover:bg-white/10 active:scale-95"
            >
              <Icon name="stop" filled className="size-4" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={duration < 1 || sending || status === "requesting"}
          aria-label="Send voice message"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition active:scale-95 disabled:bg-surface-interactive disabled:text-muted/50"
        >
          {sending ? (
            <span className="size-4 animate-spin rounded-full border-2 border-brand-fg border-t-transparent" />
          ) : (
            <Icon name="send" filled className="size-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
