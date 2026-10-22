// Browser stand-ins for MediaEngine.inspectMedia + extractThumbnail. No trim/transcode on web.

export interface VideoInfo {
  durationMs: number;
  width: number;
  height: number;
}

function load(file: Blob): Promise<{ v: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  v.src = url;
  return new Promise((res, rej) => {
    v.onloadeddata = () => res({ v, url });
    v.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("We couldn't read this video."));
    };
  });
}

function dispose(v: HTMLVideoElement, url: string) {
  v.removeAttribute("src");
  v.load();
  URL.revokeObjectURL(url);
}

/** Rejects when the browser can't decode the video track (e.g. HEVC in Chrome): videoWidth stays 0. */
export async function probeVideo(file: Blob): Promise<VideoInfo> {
  const { v, url } = await load(file);
  try {
    if (!v.videoWidth || !Number.isFinite(v.duration)) throw new Error("We couldn't read this video.");
    return { durationMs: Math.round(v.duration * 1000), width: v.videoWidth, height: v.videoHeight };
  } finally {
    dispose(v, url);
  }
}

/** First frames are often a near-black shutter artifact: skip 400 ms in when the clip is long enough. */
export function posterTimeSec(durationSeconds: number, trimStart = 0): number {
  return trimStart < 0.4 && durationSeconds > 0.8 ? trimStart + 0.4 : trimStart;
}

/** JPEG frame at `timeSec`, max `maxWidth` wide. */
export async function grabFrame(file: Blob, timeSec: number, maxWidth = 1080, quality = 0.85): Promise<Blob> {
  const { v, url } = await load(file);
  try {
    await new Promise<void>((res, rej) => {
      v.onseeked = () => res();
      v.onerror = () => rej(new Error("We couldn't read this video."));
      v.currentTime = Math.min(Math.max(0, timeSec), Math.max(0, v.duration - 0.05));
    });
    const scale = Math.min(1, maxWidth / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("Frame encode failed"))), "image/jpeg", quality),
    );
  } finally {
    dispose(v, url);
  }
}
