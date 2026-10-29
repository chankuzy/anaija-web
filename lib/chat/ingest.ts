import { normalizeImage } from "@/lib/create/image-pipeline";
import { checkVideo } from "@/lib/create/limits";
import { grabFrame, posterTimeSec, probeVideo } from "@/lib/create/video";
import type { PickedFile } from "./types";

const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "3gp"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"]);
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

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

/** About 320px JPEG, orientation-corrected. */
export async function makeThumb(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const s = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.72));
  } finally {
    bmp.close();
  }
}

/** Validates by actually decoding (extensions and MIME types alone are never trusted), one file at a time. */
export async function ingest(files: File[]): Promise<{ items: PickedFile[]; errors: string[] }> {
  const items: PickedFile[] = [];
  const errors = new Set<string>();
  for (const f of files) {
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    const isVideo = f.type.startsWith("video/") || (!f.type && VIDEO_EXT.has(ext));
    const isImage = f.type.startsWith("image/") || (!f.type && IMAGE_EXT.has(ext));
    if (!isVideo && !isImage) {
      errors.add("Only photos and videos can be added.");
      continue;
    }
    try {
      if (isVideo) {
        const info = await withTimeout(probeVideo(f), 12_000);
        const limit = checkVideo(f.size, info.durationMs);
        if (limit) {
          errors.add(limit);
          continue;
        }
        let thumb: Blob | null = null;
        try {
          thumb = await withTimeout(grabFrame(f, posterTimeSec(info.durationMs / 1000), 320, 0.7), 6_000);
        } catch {
          thumb = null;
        }
        items.push({ id: crypto.randomUUID(), kind: "video", file: f, original: f, thumb, edited: false, durationMs: info.durationMs });
      } else {
        if (f.size > MAX_IMAGE_BYTES) {
          errors.add("That photo is too large (40 MB max).");
          continue;
        }
        const file = await withTimeout(normalizeImage(f), 20_000);
        const thumb = await withTimeout(makeThumb(file), 8_000);
        items.push({ id: crypto.randomUUID(), kind: "image", file, original: file, thumb, edited: false });
      }
    } catch {
      errors.add(isVideo ? "We couldn't read that video." : "That photo can't be read. Use JPG, PNG or WebP.");
    }
  }
  return { items, errors: [...errors] };
}
