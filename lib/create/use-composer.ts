"use client";

// Composer state: the draft, per-photo edits, previews, and the actions every step shares.
// Written so mobile steps and the desktop studio drive the exact same state and upload pipeline.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { deleteDraft, saveDraft as persistDraft } from "./drafts-store";
import { FULL_CROP, exportEdited, isFullCrop, makePreview, normalizeImage, type Crop } from "./image-pipeline";
import { MediaLimits, checkVideo, tooLargeMessage } from "./limits";
import { LISTING_DEFAULTS, listingError } from "./listing";
import { IMAGE_FILTERS } from "./presets";
import { createDraft, maxSelection, type ContentDraft, type ContentKind, type DraftMedia } from "./types";
import { uploadManager } from "./upload-manager";
import { grabFrame, posterTimeSec, probeVideo } from "./video";

/** Listing shares the media steps; its fields are collected in the publish step. */
export const KIND_TABS: { id: ContentKind; label: string }[] = [
  { id: "reel", label: "Reel" },
  { id: "photo", label: "Photo" },
  { id: "story", label: "Story" },
  { id: "listing", label: "Listing" },
];

export interface EditState {
  crop: Crop;
  ratioIdx: number;
  filterIdx: number;
  size: { w: number; h: number } | null;
}
const blankEdit = (): EditState => ({ crop: FULL_CROP, ratioIdx: 0, filterIdx: 0, size: null });
export const isEdited = (e?: EditState) => !!e && (!isFullCrop(e.crop) || e.filterIdx !== 0);

export interface ToastMsg {
  id: number;
  kind: "ok" | "err";
  text: string;
}

const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "3gp"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"]);

/** Rejects with Error("timeout") so one stuck decode can never block the rest of a selection. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
const timedOut = (e: unknown) => e instanceof Error && e.message === "timeout";

export function useComposer(initialKind: ContentKind) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<ContentDraft>(() => ({ ...createDraft(initialKind), ...(initialKind === "listing" ? LISTING_DEFAULTS : {}) }));
  const draftRef = useRef(draft);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const editsRef = useRef(edits);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const urls = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [alsoShare, setAlsoShare] = useState(false);
  // Stable for this composer's lifetime: also the server-side idempotency keys.
  const [taskId] = useState(() => crypto.randomUUID());
  const [twinId] = useState(() => crypto.randomUUID());

  const apply = useCallback((fn: (d: ContentDraft) => ContentDraft) => {
    const next = fn(draftRef.current);
    draftRef.current = next;
    setDraft(next);
  }, []);
  const putEdits = useCallback((fn: (e: Record<string, EditState>) => Record<string, EditState>) => {
    const next = fn(editsRef.current);
    editsRef.current = next;
    setEdits(next);
  }, []);

  const flash = useCallback((kind: "ok" | "err", text: string) => setToast({ id: Date.now(), kind, text }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const update = useCallback((patch: Partial<ContentDraft>) => apply((d) => ({ ...d, ...patch })), [apply]);

  const dropPreview = useCallback((id: string) => {
    setPreviews((p) => {
      const u = p[id];
      if (u) {
        URL.revokeObjectURL(u);
        urls.current.delete(u);
      }
      const rest = { ...p };
      delete rest[id];
      return rest;
    });
  }, []);

  const removeMedia = useCallback(
    (id: string) => {
      dropPreview(id);
      putEdits((e) => {
        const rest = { ...e };
        delete rest[id];
        return rest;
      });
      apply((d) => ({ ...d, media: d.media.filter((m) => m.id !== id) }));
    },
    [apply, dropPreview, putEdits],
  );

  const setEdit = useCallback(
    (id: string, patch: Partial<EditState>) => putEdits((e) => ({ ...e, [id]: { ...(e[id] ?? blankEdit()), ...patch } })),
    [putEdits],
  );

  /** Whatever is first is the cover (and the first slide). */
  const makeCover = useCallback(
    (id: string) =>
      apply((d) => {
        const it = d.media.find((m) => m.id === id);
        return it ? { ...d, media: [it, ...d.media.filter((m) => m.id !== id)] } : d;
      }),
    [apply],
  );

  /** Switching kind keeps the selection (and its edits); only what the new kind can't hold is dropped. */
  const setKind = useCallback(
    (kind: ContentKind) => {
      const d = draftRef.current;
      if (kind === d.kind) return;
      const keep = d.media.filter((m) => (kind !== "listing" && kind !== "photo") || m.type === "image").slice(0, maxSelection(kind));
      const keepIds = new Set(keep.map((m) => m.id));
      d.media.forEach((m) => {
        if (!keepIds.has(m.id)) dropPreview(m.id);
      });
      putEdits((e) => Object.fromEntries(Object.entries(e).filter(([id]) => keepIds.has(id))));
      apply((x) => ({
        ...x,
        kind,
        media: keep,
        ...(kind === "listing" && x.listingType === null ? LISTING_DEFAULTS : {}),
        slideshow: { ...x.slideshow, enabled: kind === "reel" ? x.slideshow.enabled : false },
      }));
    },
    [apply, dropPreview, putEdits],
  );

  /** Port of _toggleSelect: one kind of media per selection, per-kind caps, video limits. Story keeps a single item. */
  const addFiles = useCallback(
    async (files: File[]) => {
      let err: string | null = null;
      const kind = draftRef.current.kind;
      const max = maxSelection(kind);
      for (const f of files) {
        const ext = (f.name.split(".").pop() ?? "").toLowerCase();
        const isVideo = f.type.startsWith("video/") || (!f.type && VIDEO_EXT.has(ext));
        const isImage = f.type.startsWith("image/") || (!f.type && IMAGE_EXT.has(ext));
        if (!isVideo && !isImage) {
          err = "Only photos and videos are supported";
          continue;
        }
        if ((kind === "listing" || kind === "photo") && isVideo) {
          err = kind === "photo" ? "Image posts take photos only" : "Listings take photos only";
          continue;
        }
        let cur = draftRef.current.media;
        if (max === 1 && cur.length) {
          removeMedia(cur[0].id); // single-pick: a new choice replaces the old one
          cur = [];
        }
        if (cur.length >= max) {
          err = `Up to ${max} items`;
          break;
        }
        if (cur.length && (cur[0].type === "video") !== isVideo) {
          err = "Choose photos or videos, not both";
          continue;
        }
        const id = crypto.randomUUID();
        let file = f;
        try {
          let preview: string | null = null;
          let size: { w: number; h: number } | null = null;
          let durationSeconds: number | undefined;
          if (isVideo) {
            const info = await withTimeout(probeVideo(f), 12000);
            const limit = checkVideo(f.size, info.durationMs);
            if (limit) {
              err = limit;
              continue;
            }
            durationSeconds = info.durationMs / 1000;
            size = { w: info.width, h: info.height };
            try {
              preview = URL.createObjectURL(await withTimeout(grabFrame(f, posterTimeSec(durationSeconds), 720, 0.8), 6000));
            } catch {
              preview = null;
            }
          } else {
            try {
              file = await withTimeout(normalizeImage(f), 20000);
              const p = await withTimeout(makePreview(file), 8000);
              preview = URL.createObjectURL(p.blob);
              size = { w: p.width, h: p.height };
            } catch (e) {
              if (!timedOut(e)) {
                err = "This photo can't be read. Use JPG, PNG or WebP.";
                continue;
              }
              preview = URL.createObjectURL(file); // slow decode: show the original, don't block
            }
          }
          if (preview) urls.current.add(preview);
          const item: DraftMedia = {
            id,
            original: file,
            file,
            type: isVideo ? "video" : "image",
            durationSeconds,
            ...(isVideo && size && durationSeconds !== undefined
              ? { width: size.w, height: size.h, durationMs: Math.round(durationSeconds * 1000) }
              : {}),
          };
          putEdits((e) => ({ ...e, [id]: { ...blankEdit(), size } }));
          setPreviews((p) => ({ ...p, [id]: preview }));
          apply((d) => ({ ...d, media: [...d.media, item] }));
        } catch (e) {
          err = timedOut(e)
            ? "This video took too long to read. Try an MP4."
            : e instanceof Error && isVideo
              ? e.message
              : "This file couldn't be read. Use JPG, PNG or WebP.";
        }
      }
      if (err) flash("err", err);
    },
    [apply, flash, putEdits, removeMedia],
  );

  /** Bakes crop + filter from the ORIGINALS, so going Publish -> back -> Next never edits twice. */
  const bake = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const next: DraftMedia[] = [];
      for (const m of draftRef.current.media) {
        const e = editsRef.current[m.id];
        if (m.type === "video" || !isEdited(e)) {
          next.push({ ...m, file: m.original });
          continue;
        }
        next.push({
          ...m,
          file: await exportEdited({ source: m.original, crop: e.crop, matrix: IMAGE_FILTERS[e.filterIdx].matrix }),
        });
      }
      apply((d) => ({ ...d, media: next }));
      return true;
    } catch {
      flash("err", "Couldn't apply your edits");
      return false;
    } finally {
      setBusy(false);
    }
  }, [apply, flash]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    if (!d.media.length) {
      flash("err", "Nothing to save yet");
      return false;
    }
    setBusy(true);
    try {
      const id = await persistDraft(d);
      apply((x) => ({ ...x, draftId: id }));
      flash("ok", "Draft saved");
      return true;
    } catch (e) {
      flash("err", `Couldn't save draft — ${e instanceof Error ? e.message : "try again"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [apply, flash]);

  const publish = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    if (busy) return false;
    if (!d.media.length) {
      flash("err", "Add at least one photo or video");
      return false;
    }
    const invalid = listingError(d);
    if (invalid) {
      flash("err", invalid);
      return false;
    }
    for (const m of d.media) {
      if (m.type === "video" && m.file.size > MediaLimits.maxVideoBytes) {
        flash("err", tooLargeMessage);
        return false;
      }
    }
    if (!user) {
      flash("err", "Please sign in again");
      return false;
    }
    setBusy(true);
    try {
      await Promise.race([
        uploadManager.enqueue(d, { taskId, ownerId: user.id, alsoShareRequestId: alsoShare ? twinId : null }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("enqueue timeout")), 10000)),
      ]);
      if (d.draftId) await deleteDraft(d.draftId).catch(() => {});
      setBusy(false);
      return true;
    } catch {
      setBusy(false);
      flash("err", "Couldn't start the upload. Please try again.");
      return false;
    }
  }, [alsoShare, busy, flash, taskId, twinId, user]);

  return {
    draft,
    edits,
    previews,
    busy,
    toast,
    alsoShare,
    setAlsoShare,
    flash,
    update,
    addFiles,
    removeMedia,
    makeCover,
    setKind,
    setEdit,
    bake,
    saveDraft,
    publish,
  };
}

export type Composer = ReturnType<typeof useComposer>;
