// Port of AudioAssetService. Creating a sound is two resumable steps: upload the source, then register it
// (idempotent via client_request_id). No AAC compression in the browser: files upload as picked.
import { api } from "@/lib/api/client";
import { uploadBlob } from "@/lib/api/upload";
import { MediaLimitError } from "./limits";
import { parseAudioAsset, type AudioAsset, type AudioSelection } from "./types";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_TOO_LARGE = "This audio file is larger than 25 MB. Choose a shorter track.";

const MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
};
const extOf = (f: File) => (f.name.includes(".") ? (f.name.split(".").pop() ?? "mp3") : "mp3").toLowerCase();
export const audioMime = (f: File) => MIME[extOf(f)] ?? (f.type.startsWith("audio/") ? f.type : "audio/mpeg");

export const suggestedAssetName = (s: AudioSelection) => (s.artist ? `${s.title} — ${s.artist}` : s.title);

export function probeAudio(file: File): Promise<{ durationMs: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (fn: () => void) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      a.removeAttribute("src");
      fn();
    };
    const fail = () => done(() => reject(new Error("We couldn't read this audio file.")));
    const timer = window.setTimeout(fail, 15_000);
    a.preload = "metadata";
    a.onerror = fail;
    a.onloadedmetadata = () =>
      Number.isFinite(a.duration) && a.duration > 0
        ? done(() => resolve({ durationMs: Math.round(a.duration * 1000) }))
        : fail();
    a.src = url;
  });
}

export async function listMyAssets(): Promise<AudioAsset[]> {
  const res = await api.get<{ assets?: Record<string, unknown>[] }>("audio-assets-list");
  return (res.assets ?? []).map(parseAudioAsset);
}

export const deleteAsset = (id: number) => api.delete<unknown>(`audio-assets-destroy/${id}`);

export interface AudioSourceUpload {
  storageKey: string;
  mimeType: string;
  fileSize: number;
}

export async function uploadAudioSource(file: File, signal?: AbortSignal): Promise<AudioSourceUpload> {
  if (file.size > MAX_AUDIO_BYTES) throw new MediaLimitError(AUDIO_TOO_LARGE);
  const mimeType = audioMime(file);
  const storageKey = await uploadBlob(file, `audio.${extOf(file)}`, mimeType, undefined, signal);
  return { storageKey, mimeType, fileSize: file.size };
}

/** durationMs is the length of the CLIP (not the file); the clip starts sourceStartMs into it. */
export async function registerAsset(o: {
  name: string;
  upload: AudioSourceUpload;
  durationMs: number;
  sourceStartMs: number;
  clientRequestId?: string;
}): Promise<AudioAsset> {
  const res = await api.post<{ asset: Record<string, unknown> }>("audio-assets-store", {
    name: o.name.trim() || "Untitled Audio",
    storage_key: o.upload.storageKey,
    mime_type: o.upload.mimeType,
    duration_ms: o.durationMs,
    source_start_ms: o.sourceStartMs,
    file_size: o.upload.fileSize,
    ...(o.clientRequestId ? { client_request_id: o.clientRequestId } : {}),
  });
  return parseAudioAsset(res.asset);
}
