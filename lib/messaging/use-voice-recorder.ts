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

export function getSupportedAudioMime(): { mimeType: string; ext: string } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "audio/webm", ext: "webm" };
  }
  const types = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "m4a" },
    { mimeType: "audio/aac", ext: "aac" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t.mimeType)) return t;
  }
  return { mimeType: "audio/webm", ext: "webm" };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

const MAX_RECORDING_SECONDS = 60;
const WAVEFORM_BARS = 24;

export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => new Array(WAVEFORM_BARS).fill(4));
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlob = useRef<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const mimeRef = useRef<{ mimeType: string; ext: string }>({ mimeType: "audio/webm", ext: "webm" });
  const updateLevelsRef = useRef<(() => void) | null>(null);

  const cleanupAudioNodes = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const discard = useCallback(() => {
    stopTimer();
    cleanupAudioNodes();
    cleanupStream();

    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try {
        mediaRecorder.current.stop();
      } catch {}
    }
    mediaRecorder.current = null;
    chunksRef.current = [];
    recordedBlob.current = null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setDuration(0);
    setLevels(new Array(WAVEFORM_BARS).fill(4));
    setError(null);
    setStatus("idle");
  }, [cleanupAudioNodes, cleanupStream, previewUrl, stopTimer]);

  // Audio level visualizer loop
  const updateLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const step = Math.floor(dataArray.length / WAVEFORM_BARS);
    const newLevels: number[] = [];
    for (let i = 0; i < WAVEFORM_BARS; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j] || 0;
      }
      const avg = sum / step;
      // Scale 0-255 to min 4px max 28px
      const height = Math.max(4, Math.round((avg / 255) * 28));
      newLevels.push(height);
    }

    setLevels(newLevels);
    if (updateLevelsRef.current) {
      animFrameRef.current = requestAnimationFrame(updateLevelsRef.current);
    }
  }, []);

  useEffect(() => {
    updateLevelsRef.current = updateLevels;
  }, [updateLevels]);

  const stop = useCallback(() => {
    if (!mediaRecorder.current || mediaRecorder.current.state === "inactive") return;
    stopTimer();
    cleanupAudioNodes();
    try {
      mediaRecorder.current.stop();
    } catch {}
    cleanupStream();
  }, [cleanupAudioNodes, cleanupStream, stopTimer]);

  const start = useCallback(async () => {
    setError(null);
    discard();
    setStatus("requesting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Audio recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      const detected = getSupportedAudioMime();
      mimeRef.current = detected;

      const recorder = new MediaRecorder(stream, { mimeType: detected.mimeType });
      mediaRecorder.current = recorder;
      chunksRef.current = [];

      // Setup audio analyzer
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;
        animFrameRef.current = requestAnimationFrame(updateLevels);
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current.mimeType });
        recordedBlob.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setStatus("preview");
      };

      recorder.start(100);
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      setStatus("recording");

      // Start duration ticker
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000;
        if (elapsed >= MAX_RECORDING_SECONDS) {
          setDuration(MAX_RECORDING_SECONDS);
          stop();
        } else {
          setDuration(Math.round(elapsed));
        }
      }, 250);
    } catch (err: unknown) {
      cleanupStream();
      cleanupAudioNodes();
      setStatus("idle");
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Enable microphone permissions in your browser to record voice messages."
          : err instanceof Error
          ? err.message
          : "Could not access microphone.";
      setError(msg);
    }
  }, [discard, stop, cleanupAudioNodes, cleanupStream, updateLevels]);

  const pause = useCallback(() => {
    if (!mediaRecorder.current || mediaRecorder.current.state !== "recording") return;
    mediaRecorder.current.pause();
    pauseStartRef.current = Date.now();
    stopTimer();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setStatus("paused");
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (!mediaRecorder.current || mediaRecorder.current.state !== "paused") return;
    pausedDurationRef.current += Date.now() - pauseStartRef.current;
    mediaRecorder.current.resume();
    setStatus("recording");

    if (analyserRef.current) {
      animFrameRef.current = requestAnimationFrame(updateLevels);
    }

    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000;
      if (elapsed >= MAX_RECORDING_SECONDS) {
        setDuration(MAX_RECORDING_SECONDS);
        stop();
      } else {
        setDuration(Math.round(elapsed));
      }
    }, 250);
  }, [stop, updateLevels]);

  const uploadAndGetResult = useCallback(async (): Promise<VoiceRecordingResult | null> => {
    const blob = recordedBlob.current;
    if (!blob || !previewUrl) return null;

    setStatus("uploading");
    try {
      const { mimeType, ext } = mimeRef.current;
      const filename = `voice_${Date.now()}.${ext}`;
      const mediaKey = await uploadBlob(blob, filename, mimeType);

      return {
        blob,
        blobUrl: previewUrl,
        durationSeconds: Math.max(1, duration),
        mediaKey,
        mediaType: mimeType,
      };
    } catch (err) {
      setStatus("preview");
      throw err;
    }
  }, [duration, previewUrl]);

  useEffect(() => {
    return () => {
      stopTimer();
      cleanupAudioNodes();
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [cleanupAudioNodes, cleanupStream, previewUrl, stopTimer]);

  return {
    status,
    duration,
    levels,
    error,
    previewUrl,
    start,
    stop,
    pause,
    resume,
    discard,
    uploadAndGetResult,
  };
}
