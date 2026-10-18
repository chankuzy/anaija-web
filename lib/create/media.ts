// Mirrors lib/core/config/media_limits.dart. Server twin: _shared/mediaLimits.ts.
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;
export const MAX_IMAGES = 10;
const MAX_EDGE = 1600;

export const TOO_LARGE = `This video is larger than ${MAX_VIDEO_BYTES / (1024 * 1024)} MB. Choose a shorter clip.`;
export const TOO_LONG = `Videos can be up to ${MAX_VIDEO_SECONDS / 60} minutes long.`;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

// Resize + re-encode: a phone photo is routinely several MB, the feed never shows more than ~1600px.
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format isn't supported. Use JPG, PNG or WebP.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process this image.");
  ctx.fillStyle = "#fff"; // PNG transparency would otherwise turn black in JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("Couldn't process this image.");
  return { blob, width, height };
}

export interface VideoProbe {
  duration: number;
  width: number;
  height: number;
  poster: Blob | null;
}

// Reads real metadata and grabs a poster frame (frame 0 is often a near-black shutter artifact).
export function probeVideo(file: File): Promise<VideoProbe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      fn();
    };
    const fail = () => finish(() => reject(new Error("We couldn't read this video.")));
    const timer = window.setTimeout(fail, 15_000);

    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.onerror = fail;
    v.onloadedmetadata = () => {
      if (!isFinite(v.duration) || v.duration <= 0) return fail();
      v.currentTime = v.duration > 0.8 ? 0.4 : 0;
    };
    v.onseeked = () => {
      const duration = v.duration;
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (!w || !h) return fail();
      const scale = Math.min(1, 720 / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(() => resolve({ duration, width: w, height: h, poster: null }));
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (poster) => finish(() => resolve({ duration, width: w, height: h, poster })),
        "image/jpeg",
        0.8,
      );
    };
    v.src = url;
  });
}
