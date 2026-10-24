// Port of UploadManager (upload_manager.dart + upload_task.dart). App-level publisher: owns upload lifetime so
// no screen has to. Tasks persist in IndexedDB and resume after a reload.
//
// Upload-once guarantees (same as Flutter):
//  - each media file's storage key is saved the moment it lands in R2 (thumbnail first, so a saved key means
//    the thumbnail question is already settled);
//  - the audio file key and the audio asset id are saved separately (asset registered with its own idempotency key);
//  - one task can create several posts ("targets", e.g. feed + story) sharing those keys. Each target has its own
//    client_request_id and its post_id is saved on success, so a retry only re-sends targets that aren't live yet.
import { ApiError } from "@/lib/api/client";
import { publishApi } from "@/lib/api/publish";
import { UploadError, uploadBlob } from "@/lib/api/upload";
import { registerAsset, suggestedAssetName, uploadAudioSource } from "./audio-service";
import { buildPostBody } from "./build-body";
import { idbAll, idbDelete, idbPut } from "./idb";
import { prepareImage } from "./image-pipeline";
import { MediaLimitError, MediaLimits, checkVideo } from "./limits";
import type { ContentDraft, ContentKind } from "./types";
import { grabFrame, posterTimeSec, probeVideo } from "./video";

export type UploadPhase = "queued" | "preparing" | "uploading" | "finalizing" | "published" | "failed";

export interface UploadMedia {
  id: string;
  isVideo: boolean;
  source: File;
  cover: Blob | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  storageKey?: string;
  /** undefined = not attempted yet, null = attempted / none (thumbnails never block a post). */
  thumbKey?: string | null;
}

export interface UploadTarget {
  clientRequestId: string;
  kind: ContentKind;
  /** Indexes into media; undefined = all of them. */
  mediaIndexes?: number[];
  postId?: number;
}

export interface UploadTask {
  id: string;
  ownerId: string;
  kind: ContentKind;
  createdAtMs: number;
  /** The draft with media stripped (audio stays: the file is needed until it's uploaded). */
  draft: ContentDraft;
  media: UploadMedia[];
  targets: UploadTarget[];
  phase: UploadPhase;

  audioRequestId: string;
  audioStorageKey?: string;
  audioMime?: string;
  audioFileSize?: number;
  audioAssetId?: number;
  audioStartMs?: number;
  audioPlaybackMs?: number;

  error?: string;
  retryable: boolean;
  networkFailure: boolean;
  attempts: number;

  // Transient: never meaningfully persisted.
  progress: number | null;
  cancelRequested: boolean;
}

export const isActive = (t: UploadTask) => t.phase === "preparing" || t.phase === "uploading" || t.phase === "finalizing";
const hasVideo = (t: UploadTask) => t.media.some((m) => m.isVideo);

export function uploadLabel(t: UploadTask): string {
  switch (t.phase) {
    case "queued":
      return "Waiting to upload";
    case "preparing":
      return hasVideo(t) ? "Preparing video" : "Preparing photos";
    case "uploading":
      return hasVideo(t) ? "Uploading video" : "Uploading photos";
    case "finalizing":
      return "Publishing";
    case "published":
      return t.targets.length > 1
        ? "Posted to your feed and story"
        : t.kind === "story"
          ? "Story published"
          : t.kind === "listing"
            ? "Listing published"
            : "Post published";
    case "failed":
      return t.error ?? "Upload failed";
  }
}

// ── errors ──────────────────────────────────────────────────────────────

class Cancelled extends Error {}
class ProcessingError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
  }
}
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

interface Failure {
  message: string;
  retryable: boolean;
  network?: boolean;
}
const OFFLINE: Failure = { message: "No connection. We'll retry when you're back online.", retryable: true, network: true };

const isNetworkError = (e: unknown) =>
  e instanceof TypeError || (e instanceof ApiError && e.status === 0) || (e instanceof UploadError && e.status === 0);

const isRecoverable = (e: unknown) => {
  if (isNetworkError(e)) return true;
  if (e instanceof UploadError) return e.status === 403 || e.status === 408 || e.status === 429 || e.status >= 500;
  if (e instanceof ApiError) return e.status >= 500 || e.status === 408 || e.status === 429;
  return false;
};

function classify(e: unknown): Failure {
  if (e instanceof MediaLimitError) return { message: e.message, retryable: false };
  if (e instanceof ProcessingError) return { message: e.message, retryable: e.retryable };
  if (e instanceof ApiError) {
    if (e.status === 401) return { message: "Session expired. Sign in, then retry.", retryable: true };
    const media = e.errors?.media;
    if (media) return { message: String(media), retryable: false };
    if (e.status === 0) return OFFLINE;
    if (e.status >= 500 || e.status === 408 || e.status === 429) return { message: "Server is busy. Tap retry.", retryable: true };
    return { message: e.message, retryable: false };
  }
  if (isNetworkError(e)) return OFFLINE;
  if (e instanceof UploadError) return { message: e.message, retryable: true };
  return { message: "Something went wrong. Tap retry.", retryable: true };
}

// ── state ───────────────────────────────────────────────────────────────

const tasks: UploadTask[] = [];
const aborts = new Map<string, AbortController>();
const enqueuing = new Set<string>();
const subs = new Set<() => void>();
const publishedListeners = new Set<(t: UploadTask) => void>();
let snapshot: readonly UploadTask[] = [];
let pumping = false;
let started = false;
let saveChain: Promise<void> = Promise.resolve();
let lastNotify = 0;

function notify() {
  snapshot = tasks.map((t) => ({ ...t }));
  subs.forEach((f) => f());
}
function notifyThrottled() {
  const now = Date.now();
  if (now - lastNotify < 150) return;
  lastNotify = now;
  notify();
}

/** Serialized persistence; Files/Blobs are structured-cloned into IndexedDB. */
function save(t: UploadTask): Promise<void> {
  // A stalled IndexedDB write must never freeze the queue: give up on it after 4s and move on.
  saveChain = saveChain.then(() =>
    Promise.race([
      idbPut("uploads", { ...t, progress: null, cancelRequested: false })
        .catch((e) => console.error("UploadManager: persist failed", e))
        .then(() => undefined),
      new Promise<void>((r) => setTimeout(r, 4000)),
    ]),
  );
  return saveChain;
}

const byId = (id: string) => tasks.find((t) => t.id === id);
const guard = (t: UploadTask) => {
  if (t.cancelRequested) throw new Cancelled();
};

function setPhase(t: UploadTask, p: UploadPhase) {
  t.phase = p;
  if (p !== "uploading") t.progress = null;
  void save(t);
  notify();
}

function remove(t: UploadTask) {
  const i = tasks.indexOf(t);
  if (i >= 0) tasks.splice(i, 1);
  void idbDelete("uploads", t.id).catch(() => {});
  notify();
}

const DELAYS = [2000, 6000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retryOp<T>(t: UploadTask, op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    guard(t);
    try {
      return await op();
    } catch (e) {
      if (isAbort(e) || e instanceof Cancelled) throw e;
      if (t.cancelRequested) throw new Cancelled();
      if (attempt >= DELAYS.length || !isRecoverable(e)) throw e;
      await sleep(DELAYS[attempt]);
    }
  }
}

// ── worker ──────────────────────────────────────────────────────────────

interface Prepared {
  body: Blob;
  thumb: Blob | null;
  thumbName: string;
}

const extOf = (name: string, fallback: string) => (name.includes(".") ? (name.split(".").pop() ?? fallback) : fallback).toLowerCase();

async function prepare(t: UploadTask): Promise<Map<string, Prepared>> {
  const out = new Map<string, Prepared>();
  for (const m of t.media) {
    guard(t);
    if (m.storageKey) continue; // already in R2
    if (m.isVideo) {
      let info: { durationMs: number; width: number; height: number };
      if (m.durationMs && m.width && m.height) {
        info = { durationMs: m.durationMs, width: m.width, height: m.height };
      } else {
        try {
          info = await probeVideo(m.source);
        } catch (e) {
          console.error("UploadManager: probeVideo failed", e);
          throw new ProcessingError("We couldn't read this video.", true);
        }
      }
      const limit = checkVideo(m.source.size, info.durationMs);
      if (limit) throw new MediaLimitError(limit);
      let thumb: Blob | null = m.cover ?? null;
      if (!thumb) {
        try {
          thumb = await Promise.race([
            grabFrame(m.source, posterTimeSec(info.durationMs / 1000), 720, 0.8),
            sleep(8000).then((): never => {
              throw new Error("poster timeout");
            }),
          ]);
        } catch {
          thumb = null; // a missing poster never blocks a post
        }
      }
      m.durationMs = info.durationMs;
      m.width = info.width;
      m.height = info.height;
      m.contentType = m.source.type || "video/mp4";
      m.fileName = `video.${extOf(m.source.name, "mp4")}`;
      m.sizeBytes = m.source.size;
      out.set(m.id, { body: m.source, thumb, thumbName: "thumb.jpg" });
    } else {
      let p;
      try {
        p = await prepareImage(m.source);
      } catch (e) {
        console.error("UploadManager: prepareImage failed", e);
        throw new ProcessingError("This image format isn't supported. Use JPG, PNG or WebP.", true);
      }
      m.contentType = p.contentType;
      m.fileName = `feed.${p.ext}`;
      m.width = p.width;
      m.height = p.height;
      m.sizeBytes = p.feed.size;
      out.set(m.id, { body: p.feed, thumb: p.thumb, thumbName: `thumb.${p.ext}` });
    }
    await save(t);
  }
  return out;
}

async function upload(t: UploadTask, prepared: Map<string, Prepared>, signal: AbortSignal) {
  let total = 0;
  for (const m of t.media) {
    const p = prepared.get(m.id);
    if (!m.storageKey) total += p?.body.size ?? 0;
    if (m.thumbKey === undefined) total += p?.thumb?.size ?? 0;
  }
  let done = 0;
  const report = (current: number) => {
    t.progress = total === 0 ? null : Math.min(1, (done + current) / total);
    notifyThrottled();
  };
  const put = async (blob: Blob, name: string, type: string) => {
    const key = await retryOp(t, () => uploadBlob(blob, name, type, report, signal));
    done += blob.size;
    report(0);
    return key;
  };

  for (const m of t.media) {
    guard(t);
    const p = prepared.get(m.id);

    if (m.thumbKey === undefined) {
      if (p?.thumb) {
        try {
          m.thumbKey = await put(p.thumb, p.thumbName, p.thumb.type || "image/jpeg");
        } catch (e) {
          if (isAbort(e) || e instanceof Cancelled) throw e;
          m.thumbKey = null; // thumbnails are optional, never block a post
        }
      } else {
        m.thumbKey = null;
      }
      await save(t);
    }

    if (!m.storageKey) {
      if (!p) throw new ProcessingError("The original file is no longer available.", false);
      m.storageKey = await put(p.body, m.fileName, m.contentType);
      await save(t);
    }
  }

  await ensureAudio(t, signal);
}

/** Audio goes up once per task, in two persisted steps; every target reuses the result. */
async function ensureAudio(t: UploadTask, signal: AbortSignal) {
  if (t.audioAssetId != null) return;
  guard(t);

  const reuse = t.draft.audioAsset; // an existing sound from My Sounds
  if (reuse) {
    t.audioAssetId = reuse.id;
    t.audioStartMs = reuse.sourceStartMs;
    t.audioPlaybackMs = reuse.durationMs;
    await save(t);
    return;
  }

  const sel = t.draft.audio;
  if (!sel) return;

  if (!t.audioStorageKey) {
    const up = await retryOp(t, () => uploadAudioSource(sel.file, signal));
    t.audioStorageKey = up.storageKey;
    t.audioMime = up.mimeType;
    t.audioFileSize = up.fileSize;
    await save(t);
  }

  const playbackMs = Math.min(1 << 30, Math.max(500, sel.trackDurationMs - sel.startMs));
  const asset = await retryOp(t, () =>
    registerAsset({
      name: sel.assetName ?? suggestedAssetName(sel),
      upload: { storageKey: t.audioStorageKey!, mimeType: t.audioMime ?? "audio/mp4", fileSize: t.audioFileSize ?? 0 },
      durationMs: playbackMs,
      sourceStartMs: sel.startMs,
      clientRequestId: t.audioRequestId,
    }),
  );
  t.audioAssetId = asset.id;
  t.audioStartMs = sel.startMs;
  t.audioPlaybackMs = playbackMs;
  await save(t);
}

const toApiMedia = (m: UploadMedia): Record<string, unknown> => ({
  type: m.isVideo ? "video" : "image",
  storage_key: m.storageKey,
  ...(m.thumbKey ? { thumbnail_key: m.thumbKey } : {}),
  ...(m.isVideo && m.durationMs ? { duration_seconds: Math.round(m.durationMs / 1000) } : {}),
  ...((m.width ?? 0) > 0 ? { width: m.width } : {}),
  ...((m.height ?? 0) > 0 ? { height: m.height } : {}),
  ...((m.width ?? 0) > 0 && (m.height ?? 0) > 0 ? { aspect_ratio: m.width! / m.height! } : {}),
  size_bytes: m.sizeBytes,
  mime_type: m.contentType,
});

/** Stories are short-form: sound-driven length never exceeds the cap. The shared asset keeps its full window. */
function audioConfigFor(t: UploadTask, kind: ContentKind): Record<string, unknown> | null {
  if (t.audioAssetId == null) return null;
  let ms = t.audioPlaybackMs ?? 0;
  if (kind === "story") ms = Math.min(MediaLimits.maxStoryAudioSeconds * 1000, Math.max(500, ms));
  return { enabled: true, start_ms: t.audioStartMs ?? 0, ...(ms > 0 ? { playback_duration_ms: ms } : {}) };
}

function bodyFor(t: UploadTask, target: UploadTarget) {
  const idx = target.mediaIndexes ?? t.media.map((_, i) => i);
  const media = idx.filter((i) => i >= 0 && i < t.media.length).map((i) => t.media[i]);
  return buildPostBody(
    { ...t.draft, kind: target.kind },
    {
      media: media.map(toApiMedia),
      imageCount: media.filter((m) => !m.isVideo).length,
      clientRequestId: target.clientRequestId,
      audioAssetId: t.audioAssetId ?? null,
      audioConfig: audioConfigFor(t, target.kind),
    },
  );
}

async function finalize(t: UploadTask) {
  let firstError: unknown;
  for (const target of t.targets) {
    if (target.postId != null) continue; // already live, never re-sent
    guard(t);
    try {
      const body = bodyFor(t, target);
      // Safe to retry: the server returns the existing post for a repeated client_request_id.
      const res = await retryOp(t, () => publishApi.store(body));
      if (typeof res.post_id !== "number") throw new Error("posts-store returned no post_id");
      target.postId = res.post_id;
      await save(t);
    } catch (e) {
      if (e instanceof Cancelled || isAbort(e)) throw e;
      if (t.cancelRequested) throw new Cancelled();
      firstError ??= e; // one target failing must not block the other
    }
  }
  if (firstError !== undefined) throw firstError;
}

async function run(t: UploadTask) {
  t.attempts++;
  const ctrl = new AbortController();
  aborts.set(t.id, ctrl);
  try {
    setPhase(t, "preparing");
    const prepared = await prepare(t);
    guard(t);
    setPhase(t, "uploading");
    await upload(t, prepared, ctrl.signal);
    guard(t);
    setPhase(t, "finalizing");
    await finalize(t);

    t.phase = "published";
    t.progress = 1;
    notify();
    void idbDelete("uploads", t.id).catch(() => {});
    publishedListeners.forEach((f) => f(t));
    setTimeout(() => {
      const x = byId(t.id);
      if (x && x.phase === "published") remove(x);
    }, 4000);
  } catch (e) {
    if (e instanceof Cancelled || isAbort(e) || t.cancelRequested) {
      remove(t);
      return;
    }
    console.error(`UploadManager: task ${t.id} failed`, e);
    const f = classify(e);
    t.phase = "failed";
    t.error = f.message;
    t.retryable = f.retryable;
    t.networkFailure = !!f.network;
    t.progress = null;
    await save(t);
    notify();
  } finally {
    aborts.delete(t.id);
  }
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const next = tasks.find((t) => t.phase === "queued");
      if (!next) break; // no await between this and the flag reset
      await run(next);
    }
  } finally {
    pumping = false;
  }
}

// ── public API ──────────────────────────────────────────────────────────

function retryTask(id: string) {
  const t = byId(id);
  if (!t || t.phase !== "failed" || !t.retryable) return;
  t.phase = "queued";
  t.error = undefined;
  t.networkFailure = false;
  t.progress = null;
  void save(t);
  notify();
  void pump();
}

function resumeNetworkFailures() {
  for (const t of [...tasks]) if (t.phase === "failed" && t.retryable && t.networkFailure) retryTask(t.id);
}

/** Call once the signed-in user is known: loads leftovers from a previous session and resumes them. */
async function start(ownerId: string | number) {
  const owner = String(ownerId);
  if (!started) {
    started = true;
    window.addEventListener("online", resumeNetworkFailures);
  }
  let saved: UploadTask[] = [];
  try {
    saved = await idbAll<UploadTask>("uploads");
  } catch (e) {
    console.error("UploadManager: load failed", e);
  }
  for (const t of saved) {
    // Another account's leftovers (or a finished task) must never publish under the current user.
    if (t.ownerId !== owner || t.phase === "published") {
      void idbDelete("uploads", t.id).catch(() => {});
      continue;
    }
    if (tasks.some((x) => x.id === t.id)) continue;
    if (isActive(t)) t.phase = "queued"; // interrupted mid-flight
    t.progress = null;
    t.cancelRequested = false;
    tasks.push(t);
  }
  tasks.sort((a, b) => a.createdAtMs - b.createdAtMs);
  notify();
  void pump();
}

/**
 * Persists everything needed to publish, then returns. Safe to call twice with the same taskId (double-click).
 * alsoShareRequestId adds the other half of a cross-post as a second target of THIS task (media and audio upload
 * once): a story becomes a feed post too; a post/listing also becomes a story (first item only).
 */
async function enqueue(
  draft: ContentDraft,
  o: { taskId: string; ownerId: string | number; alsoShareRequestId?: string | null },
): Promise<string> {
  if (byId(o.taskId) || enqueuing.has(o.taskId)) return o.taskId;
  enqueuing.add(o.taskId);
  try {
    const media: UploadMedia[] = draft.media.map((m) => ({
      id: m.id,
      isVideo: m.type === "video",
      source: m.file,
      cover: m.type === "video" ? (m.cover ?? null) : null,
      fileName: "",
      contentType: "",
      sizeBytes: m.file.size,
      ...(m.type === "video" ? { durationMs: m.durationMs, width: m.width, height: m.height } : {}),
    }));

    const targets: UploadTarget[] = [{ clientRequestId: o.taskId, kind: draft.kind }];
    if (o.alsoShareRequestId && media.length > 0) {
      targets.push(
        draft.kind === "story"
          ? { clientRequestId: o.alsoShareRequestId, kind: "reel" }
          : { clientRequestId: o.alsoShareRequestId, kind: "story", mediaIndexes: [0] },
      );
    }

    const task: UploadTask = {
      id: o.taskId,
      ownerId: String(o.ownerId),
      kind: draft.kind,
      createdAtMs: Date.now(),
      draft: { ...draft, media: [] },
      media,
      targets,
      phase: "queued",
      audioRequestId: crypto.randomUUID(),
      retryable: false,
      networkFailure: false,
      attempts: 0,
      progress: null,
      cancelRequested: false,
    };
    tasks.push(task);
    void save(task);
    notify();
    void pump();
    return o.taskId;
  } finally {
    enqueuing.delete(o.taskId);
  }
}

function cancel(id: string) {
  const t = byId(id);
  if (!t || t.phase === "finalizing") return;
  t.cancelRequested = true;
  aborts.get(id)?.abort();
  if (!isActive(t)) remove(t); // running tasks clean up when they notice
}

function dismiss(id: string) {
  const t = byId(id);
  if (t && !isActive(t)) remove(t);
}

export const uploadManager = {
  start,
  enqueue,
  retry: retryTask,
  cancel,
  dismiss,
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  },
  getSnapshot: () => snapshot,
  /** Fires when a task finishes publishing (refresh whatever shows it). Returns an unsubscribe. */
  onPublished(cb: (t: UploadTask) => void) {
    publishedListeners.add(cb);
    return () => {
      publishedListeners.delete(cb);
    };
  },
};
