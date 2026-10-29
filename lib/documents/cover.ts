"use client";

import { loadPdfjs } from "./pdf";

const TIMEOUT_MS = 15_000;

/** Page 1 of a PDF as a JPEG cover. Never throws: null means "no cover", and the upload carries on without one. */
export async function renderPdfCover(file: File, width = 640): Promise<File | null> {
  let destroy: (() => void) | null = null;
  const work = (async (): Promise<File | null> => {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const loading = pdfjs.getDocument({ data });
    destroy = () => void loading.destroy();
    const doc = await loading.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    page.cleanup();
    return blob ? new File([blob], "cover.jpg", { type: "image/jpeg" }) : null;
  })().catch(() => null);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), TIMEOUT_MS));
  try {
    return await Promise.race([work, timeout]);
  } finally {
    (destroy as (() => void) | null)?.();
  }
}
