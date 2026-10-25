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
    previewUrl,
    pause,
    resume,
    stop,
    discard,
    uploadAndGetResult,
  } = recorder;

  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [sending, setSending] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop preview audio when previewUrl changes or resets
  useEffect(() => {
    if (!previewUrl) return;
    const a = new Audio(previewUrl);
    previewAudioRef.current = a;
    a.onended = () => setPreviewPlaying(false);
    return () => {
      a.pause();
      a.removeAttribute("src");
      previewAudioRef.current = null;
    };
  }, [previewUrl]);

  function togglePreviewPlay() {
    const a = previewAudioRef.current;
    if (!a) return;
    if (previewPlaying) {
      a.pause();
      setPreviewPlaying(false);
    } else {
      a.play().then(() => setPreviewPlaying(true)).catch(() => setPreviewPlaying(false));
    }
  }

  async function handleSend() {
    if (sending) return;
    if (status === "recording" || status === "paused") {
      stop();
    }
    setSending(true);
    try {
      const res = await uploadAndGetResult();
      if (res) {
        await onSend(res);
        discard();
        onCancel();
      }
    } catch {
      // Keep in preview so user can retry sending without re-recording!
    } finally {
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

  return (
    <div className="flex items-center justify-between gap-2.5 rounded-[26px] bg-surface-subtle p-1.5 px-3">
      {/* Discard recording */}
      <button
        type="button"
        onClick={handleDiscard}
        disabled={sending}
        aria-label="Discard recording"
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-danger active:scale-95 disabled:opacity-40"
      >
        <Icon name="trash" className="size-5" />
      </button>

      {/* Recording indicator & timer */}
      <div className="flex items-center gap-2">
        {status === "recording" && (
          <span className="size-2.5 rounded-full bg-danger animate-pulse shrink-0" />
        )}
        <span className="text-[13.5px] font-mono font-bold text-fg tabular-nums w-10">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Waveform visualization / Preview player */}
      <div className="flex-1 flex items-center justify-center h-8 px-2 overflow-hidden">
        {status === "preview" ? (
          <button
            type="button"
            onClick={togglePreviewPlay}
            aria-label={previewPlaying ? "Pause preview" : "Play preview"}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-secondary font-bold text-fg hover:bg-white/15"
          >
            <Icon name={previewPlaying ? "pause" : "play"} filled className="size-4" />
            <span>{previewPlaying ? "Playing" : "Preview"}</span>
          </button>
        ) : (
          <div className="flex items-center gap-[3px] h-full">
            {levels.map((lvl, idx) => (
              <span
                key={idx}
                className={`w-[3px] rounded-full transition-all duration-75 ${
                  status === "recording" ? "bg-brand" : "bg-muted"
                }`}
                style={{ height: `${lvl}px` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pause / Resume / Stop button */}
      {status === "recording" && (
        <button
          type="button"
          onClick={pause}
          aria-label="Pause recording"
          className="grid size-9 shrink-0 place-items-center rounded-full text-fg hover:bg-white/10 active:scale-95"
        >
          <Icon name="pause" className="size-5" />
        </button>
      )}

      {status === "paused" && (
        <button
          type="button"
          onClick={resume}
          aria-label="Resume recording"
          className="grid size-9 shrink-0 place-items-center rounded-full text-brand hover:bg-white/10 active:scale-95"
        >
          <Icon name="play" filled className="size-5" />
        </button>
      )}

      {/* Send button */}
      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={duration < 1 || sending}
        aria-label="Send voice message"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition active:scale-95 disabled:bg-surface-interactive disabled:text-muted/50"
      >
        {sending ? (
          <span className="size-4 border-2 border-brand-fg border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon name="send" filled className="size-[18px]" />
        )}
      </button>
    </div>
  );
}
