// Port of image_export_service.dart (crop + filter bake) and image_feed_pipeline.dart (feed + thumb prep).
import { applyColorMatrix, isIdentity } from "./presets";

export interface Crop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export const FULL_CROP: Crop = { left: 0, top: 0, right: 1, bottom: 1 };
export const isFullCrop = (r: Crop) => r.left <= 0.001 && r.top <= 0.001 && r.right >= 0.999 && r.bottom >= 0.999;

const MAX_EDGE = 2560;
// Safari/iOS cap canvas area around 16.7 MP; stay under it so a big crop never silently fails.
const MAX_PIXELS = 6_000_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const decode = (file: Blob) => createImageBitmap(file, { imageOrientation: "from-image" });

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Image encode failed"))), type, quality),
  );
}

/** Pixel size after EXIF orientation, same decode path as exportEdited so crop math always agrees. */
export async function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  const bmp = await decode(file);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

/** Bakes crop + color matrix from the ORIGINAL into a lossless PNG (prepareImage shrinks it later). */
export async function exportEdited(opts: {
  source: File;
  crop: Crop;
  matrix: readonly number[];
}): Promise<File> {
  const bmp = await decode(opts.source);
  try {
    const sw = bmp.width;
    const sh = bmp.height;
    const sx = clamp(opts.crop.left * sw, 0, sw - 1);
    const sy = clamp(opts.crop.top * sh, 0, sh - 1);
    const w = Math.max(1, clamp(opts.crop.right * sw, 1, sw) - sx);
    const h = Math.max(1, clamp(opts.crop.bottom * sh, 1, sh) - sy);

    let outW = clamp(Math.round(w), 1, MAX_EDGE);
    let outH = clamp(Math.round(h), 1, MAX_EDGE);
    if (outW * outH > MAX_PIXELS) {
      const s = Math.sqrt(MAX_PIXELS / (outW * outH));
      outW = Math.max(1, Math.floor(outW * s));
      outH = Math.max(1, Math.floor(outH * s));
    }

    const c = canvas(outW, outH);
    const ctx = c.getContext("2d", { willReadFrequently: !isIdentity(opts.matrix) });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, sx, sy, w, h, 0, 0, outW, outH);
    if (!isIdentity(opts.matrix)) {
      const img = ctx.getImageData(0, 0, outW, outH);
      applyColorMatrix(img, opts.matrix);
      ctx.putImageData(img, 0, 0);
    }
    const blob = await toBlob(c, "image/png");
    return new File([blob], `edited_${Date.now()}.png`, { type: "image/png" });
  } finally {
    bmp.close();
  }
}

export interface PreparedImage {
  feed: Blob;
  thumb: Blob;
  width: number;
  height: number;
  contentType: string;
  ext: string;
}

const FEED_EDGE = 1440;
const FEED_QUALITY = 0.82;
const THUMB_EDGE = 480;
const THUMB_QUALITY = 0.7;

async function encode(bmp: ImageBitmap, longEdge: number, quality: number) {
  const scale = Math.min(1, longEdge / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const c = canvas(width, height);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  // WebP like the app; browsers that can't encode it return PNG, so fall back to JPEG instead.
  let blob = await toBlob(c, "image/webp", quality);
  if (blob.type !== "image/webp") blob = await toBlob(c, "image/jpeg", quality);
  return { blob, width, height };
}

/** Feed copy (long edge <= 1440, q82) + thumbnail (<= 480, q70). Dimensions are of the feed copy. */
export async function prepareImage(source: Blob): Promise<PreparedImage> {
  const bmp = await decode(source);
  try {
    const feed = await encode(bmp, FEED_EDGE, FEED_QUALITY);
    const thumb = await encode(bmp, THUMB_EDGE, THUMB_QUALITY);
    const webp = feed.blob.type === "image/webp";
    return {
      feed: feed.blob,
      thumb: thumb.blob,
      width: feed.width,
      height: feed.height,
      contentType: webp ? "image/webp" : "image/jpeg",
      ext: webp ? "webp" : "jpg",
    };
  } finally {
    bmp.close();
  }
}

const PREVIEW_EDGE = 1280;

/** One decode gives both the true (orientation-corrected) size and a light preview, so the picker never holds originals. */
export async function makePreview(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await decode(file);
  try {
    const width = bmp.width;
    const height = bmp.height;
    const scale = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
    const c = canvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return { blob: await toBlob(c, "image/jpeg", 0.85), width, height };
  } finally {
    bmp.close();
  }
}

const isHeic = (f: File) => /^image\/hei[cf]$/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

/** HEIC/HEIF the browser can't decode (Chrome, Android, most desktops) becomes JPEG once, at pick time. */
export async function normalizeImage(f: File): Promise<File> {
  if (!isHeic(f)) return f;
  try {
    (await decode(f)).close();
    return f; // Safari decodes it natively
  } catch {
    /* convert below */
  }
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], `${f.name.replace(/\.hei[cf]$/i, "")}.jpg`, { type: "image/jpeg" });
}
