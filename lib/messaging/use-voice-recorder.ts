"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadBlob } from "@/lib/api/upload";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "preview"
  | "uploading";

export interface VoiceRecordingResult {
  blob: Blob;
  blobUrl: string;
  durationSeconds: number;
  mediaKey: string;
  mediaType: string;
}

const CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];
const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};

// "audio/webm;codecs=opus" -> "audio/webm". Servers and presigned URLs match on the bare type.
export const baseMime = (m: string) => m.split(";")[0].trim().toLowerCase();

export function getSupportedAudioMime(): { mimeType: string; ext: string } {
  const fallback = { mimeType: "audio/webm", ext: "webm" };
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return fallback;
  for (const t of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return { mimeType: t, ext: EXT[baseMime(t)] ?? "webm" };
  }
  return fallback;
}

export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export const MAX_RECORDING_SECONDS = 60;
const BARS = 24;
const flat = () => new Array<number>(BARS).fill(4);

export function useVoiceRecorder(maxSeconds = MAX_RECORDING_SECONDS) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>(flat);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);
  const uploaded = useRef<{ blob: Blob; key: string } | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const startAt = useRef(0);
  const pausedMs = useRef(0);
  const pauseAt = useRef(0);
  const seconds = useRef(0);
  const lastLevel = useRef(0);
  const mime = useRef<{ mimeType: string; ext: string }>({ mimeType: "audio/webm", ext: "webm" });

  const elapsed = () => (Date.now() - startAt.current - pausedMs.current) / 1000;

  const stopTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    analyser.current = null;
    const c = ctx.current;
    ctx.current = null;
    if (c && c.state !== "closed") c.close().catch(() => {});
  }, []);

  const releaseStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const startMeter = useCallback((s: MediaStream) => {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const c = new AC();
      ctx.current = c;
      const a = c.createAnalyser();
      a.fftSize = 256;
      c.createMediaStreamSource(s).connect(a);
      analyser.current = a;
      const buf = new Uint8Array(a.fftSize);
      const loop = () => {
        const an = analyser.current;
        if (!an) return;
        raf.current = requestAnimationFrame(loop);
        const now = performance.now();
        if (now - lastLevel.current < 60) return;
        lastLevel.current = now;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const h = Math.round(4 + Math.min(1, rms * 4) * 24);
        setLevels((prev) => [...prev.slice(1), h]);
      };
      raf.current = requestAnimationFrame(loop);
    } catch {
      /* the meter is cosmetic; recording works without it */
    }
  }, []);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r || r.state === "inactive") return;
    if (r.state === "recording") seconds.current = Math.min(maxSeconds, elapsed());
    stopTimer();
    stopMeter();
    try {
      r.stop();
    } catch {}
  }, [maxSeconds, stopMeter, stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    timer.current = window.setInterval(() => {
      const e = elapsed();
      if (e >= maxSeconds) {
        seconds.current = maxSeconds;
        setDuration(maxSeconds);
        stop();
        return;
      }
      seconds.current = e;
      setDuration(Math.floor(e));
    }, 200);
  }, [maxSeconds, stop, stopTimer]);

  // revoke=false hands the preview blob URL over to the sent message, which is still playing it.
  const reset = useCallback(
    (revoke: boolean) => {
      stopTimer();
      stopMeter();
      const r = rec.current;
      if (r) {
        r.onstop = null;
        r.ondataavailable = null;
        r.onerror = null;
        if (r.state !== "inactive") {
          try {
            r.stop();
          } catch {}
        }
      }
      rec.current = null;
      releaseStream();
      chunks.current = [];
      blob.current = null;
      uploaded.current = null;
      if (urlRef.current && revoke) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      seconds.current = 0;
      setPreviewUrl(null);
      setDuration(0);
      setLevels(flat());
      setError(null);
      setUploadError(null);
      setProgress(0);
      setStatus("idle");
    },
    [releaseStream, stopMeter, stopTimer],
  );

  const discard = useCallback(() => reset(true), [reset]);
  const finish = useCallback(() => reset(false), [reset]);

  const start = useCallback(async () => {
    reset(true);
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Voice recording isn't supported in this browser.");
      }
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.current = s;

      const detected = getSupportedAudioMime();
      let r: MediaRecorder;
      try {
        r = new MediaRecorder(s, { mimeType: detected.mimeType });
      } catch {
        r = new MediaRecorder(s);
      }
      const base = baseMime(r.mimeType || detected.mimeType);
      mime.current = { mimeType: base, ext: EXT[base] ?? detected.ext };
      rec.current = r;
      chunks.current = [];

      r.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      r.onerror = () => {
        reset(true);
        setError("Recording failed. Try again.");
      };
      r.onstop = () => {
        releaseStream();
        const b = new Blob(chunks.current, { type: mime.current.mimeType });
        if (b.size === 0) {
          reset(true);
          setError("Nothing was recorded. Try again.");
          return;
        }
        blob.current = b;
        const u = URL.createObjectURL(b);
        urlRef.current = u;
        setPreviewUrl(u);
        setDuration(Math.floor(seconds.current));
        setStatus("preview");
      };

      startMeter(s);
      r.start(250);
      startAt.current = Date.now();
      pausedMs.current = 0;
      pauseAt.current = 0;
      seconds.current = 0;
      setStatus("recording");
      startTimer();
    } catch (err: unknown) {
      reset(true);
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser settings to send voice messages."
          : name === "NotFoundError"
            ? "No microphone was found on this device."
            : name === "NotReadableError"
              ? "The microphone is busy in another app."
              : err instanceof Error
                ? err.message
                : "Could not access the microphone.",
      );
    }
  }, [releaseStream, reset, startMeter, startTimer]);

  const pause = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== "recording") return;
    seconds.current = elapsed();
    r.pause();
    pauseAt.current = Date.now();
    stopTimer();
    stopMeter();
    setStatus("paused");
  }, [stopMeter, stopTimer]);

  const resume = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== "paused") return;
    pausedMs.current += Date.now() - pauseAt.current;
    r.resume();
    if (stream.current) startMeter(stream.current);
    startTimer();
    setStatus("recording");
  }, [startMeter, startTimer]);

  // Uploads once. If the upload succeeded but something after it failed, the key is reused.
  const uploadAndGetResult = useCallback(async (): Promise<VoiceRecordingResult | null> => {
    const live = rec.current;
    if (live && live.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const prev = live.onstop;
        live.onstop = (ev) => {
          prev?.call(live, ev);
          resolve();
        };
        stop();
      });
    }

    const b = blob.current;
    if (!b || b.size === 0) {
      setUploadError("Nothing was recorded.");
      return null;
    }

    setUploadError(null);
    setProgress(0);
    setStatus("uploading");
    try {
      const { mimeType, ext } = mime.current;
      let key = uploaded.current?.blob === b ? uploaded.current.key : null;
      if (!key) {
        key = await uploadBlob(b, `voice_${Date.now()}.${ext}`, mimeType, (sent) =>
          setProgress(Math.min(1, sent / b.size)),
        );
        uploaded.current = { blob: b, key };
      }
      return {
        blob: b,
        blobUrl: urlRef.current ?? URL.createObjectURL(b),
        durationSeconds: Math.max(1, Math.round(seconds.current)),
        mediaKey: key,
        mediaType: mimeType,
      };
    } catch (err) {
      setStatus("preview");
      setUploadError(
        `${err instanceof Error ? err.message : "Upload failed."} Tap send to try again.`,
      );
      throw err;
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopMeter();
      const r = rec.current;
      if (r) {
        r.onstop = null;
        r.ondataavailable = null;
        r.onerror = null;
        if (r.state !== "inactive") {
          try {
            r.stop();
          } catch {}
        }
      }
      releaseStream();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [releaseStream, stopMeter, stopTimer]);

  return {
    status,
    duration,
    levels,
    error,
    uploadError,
    progress,
    previewUrl,
    maxSeconds,
    start,
    stop,
    pause,
    resume,
    discard,
    finish,
    uploadAndGetResult,
  };
}
