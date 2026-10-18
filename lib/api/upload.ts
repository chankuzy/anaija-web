import { api } from "./client";

export class UploadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

// Objects are content-addressed by a fresh UUID and never overwritten (same as the Flutter client).
const IMMUTABLE = "public, max-age=31536000, immutable";
const retryable = (e: unknown) =>
  e instanceof UploadError && (e.status === 0 || e.status === 403 || e.status === 408 || e.status === 429 || e.status >= 500);

function putOnce(url: string, body: Blob, contentType: string, onProgress?: (sent: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", contentType);
    x.setRequestHeader("Cache-Control", IMMUTABLE);
    x.timeout = 120_000;
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded);
    };
    x.onload = () =>
      x.status >= 200 && x.status < 300 ? resolve() : reject(new UploadError(x.status, `Upload failed (${x.status})`));
    x.onerror = () => reject(new UploadError(0, "Network error during upload."));
    x.ontimeout = () => reject(new UploadError(408, "Upload timed out."));
    signal?.addEventListener("abort", () => {
      x.abort();
      reject(new DOMException("Aborted", "AbortError"));
    });
    x.send(body);
  });
}

// Sign + PUT, re-signing on retryable failures (an expired presigned URL is fixed by signing again).
export async function uploadBlob(
  blob: Blob,
  filename: string,
  contentType: string,
  onProgress?: (sent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const signed = await api.post<{ path: string; signed_url: string }>("storage-sign-upload", { filename });
      await putOnce(signed.signed_url, blob, contentType, onProgress, signal);
      return signed.path;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      last = e;
      if (!retryable(e)) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw last;
}
