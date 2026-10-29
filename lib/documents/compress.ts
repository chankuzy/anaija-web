"use client";

import { loadPdfjs } from "./pdf";

// Shrinks a PDF on the phone before it is uploaded.
//  1. images: every big embedded JPEG is re-encoded at screen resolution (scans are most of what students share)
//  2. pages: if it is still large, each page is rendered to a JPEG and rebuilt as a new PDF (text becomes pictures)
// Never throws. On failure, or when nothing is gained, the original file comes back untouched.

export interface PackResult {
  file: File;
  before: number;
  after: number;
  mode: "none" | "images" | "pages";
}

const SKIP_BELOW = 400 * 1024;
const RASTER_IF_OVER = 6 * 1024 * 1024;
const MAX_RASTER_PAGES = 120;
const IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.68;
const PAGE_WIDTH = 1200;
const PAGE_QUALITY = 0.6;
const TIMEOUT_MS = 120_000;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const part = (u: Uint8Array) => u as unknown as BlobPart;
const toJpeg = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));

type Lib = typeof import("pdf-lib");
type Job = [import("pdf-lib").PDFRef, import("pdf-lib").PDFRawStream];

async function recompressImages(bytes: Uint8Array, report: (p: number) => void): Promise<Uint8Array | null> {
  const { PDFDocument, PDFName, PDFRawStream } = (await import("pdf-lib")) as Lib;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const ctx = doc.context;
  const jobs: Job[] = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (d.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    if (d.get(PDFName.of("Filter")) !== PDFName.of("DCTDecode")) continue;
    if (d.has(PDFName.of("ImageMask")) || d.has(PDFName.of("Mask"))) continue;
    if (obj.contents.length < 60 * 1024) continue;
    jobs.push([ref, obj]);
  }
  let changed = 0;
  for (let i = 0; i < jobs.length; i++) {
    const [ref, obj] = jobs[i];
    report(i / jobs.length);
    try {
      // PDF viewers ignore EXIF rotation, so decode the pixels exactly as stored.
      const bmp = await createImageBitmap(new Blob([part(obj.contents)], { type: "image/jpeg" }), { imageOrientation: "none" } as unknown as ImageBitmapOptions);
      const k = Math.min(1, IMAGE_EDGE / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * k));
      const h = Math.max(1, Math.round(bmp.height * k));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d");
      if (!g) {
        bmp.close();
        continue;
      }
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
      g.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const blob = await toJpeg(canvas, IMAGE_QUALITY);
      canvas.width = 0;
      canvas.height = 0;
      if (!blob || blob.size > obj.contents.length * 0.85) continue;
      const data = new Uint8Array(await blob.arrayBuffer());
      const dict = ctx.obj({ Type: "XObject", Subtype: "Image", Width: w, Height: h, ColorSpace: "DeviceRGB", BitsPerComponent: 8, Filter: "DCTDecode", Length: data.length });
      const soft = obj.dict.get(PDFName.of("SMask"));
      if (soft) dict.set(PDFName.of("SMask"), soft);
      ctx.assign(ref, PDFRawStream.of(dict, data));
      changed++;
    } catch {
      /* leave this image as it was */
    }
    await tick();
  }
  if (!changed) return null;
  report(1);
  return await doc.save({ useObjectStreams: true });
}

async function rasterize(file: File, report: (p: number) => void): Promise<Uint8Array | null> {
  const [pdfjs, { PDFDocument }] = await Promise.all([loadPdfjs(), import("pdf-lib")]);
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const src = await task.promise;
    const total = src.numPages;
    if (total > MAX_RASTER_PAGES) return null;
    const out = await PDFDocument.create();
    for (let n = 1; n <= total; n++) {
      report((n - 1) / total);
      const page = await src.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(3, PAGE_WIDTH / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const g = canvas.getContext("2d");
      if (!g) return null;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: g, viewport: vp }).promise;
      const blob = await toJpeg(canvas, PAGE_QUALITY);
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) return null;
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const pg = out.addPage([base.width, base.height]);
      pg.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      await tick();
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    void task.destroy();
  }
}

export async function packPdf(file: File, onProgress?: (p: number) => void): Promise<PackResult> {
  const same: PackResult = { file, before: file.size, after: file.size, mode: "none" };
  if (file.size < SKIP_BELOW) return same;
  const report = (p: number) => onProgress?.(Math.min(1, Math.max(0, p)));

  const work = (async (): Promise<PackResult> => {
    let best: { bytes: Uint8Array; mode: "images" | "pages" } | null = null;
    try {
      const out = await recompressImages(new Uint8Array(await file.arrayBuffer()), (p) => report(p * 0.5));
      if (out && out.length < file.size * 0.92) best = { bytes: out, mode: "images" };
    } catch {
      /* encrypted or unusual file: fall through */
    }
    const now: number = best ? best.bytes.length : file.size;
    if (now > RASTER_IF_OVER) {
      try {
        const out = await rasterize(file, (p) => report(0.5 + p * 0.5));
        if (out && out.length < now * 0.75) best = { bytes: out, mode: "pages" };
      } catch {
        /* keep what we have */
      }
    }
    if (!best) return same;
    const packed = new File([part(best.bytes)], file.name, { type: "application/pdf", lastModified: Date.now() });
    return { file: packed, before: file.size, after: packed.size, mode: best.mode };
  })().catch(() => same);

  const timeout = new Promise<PackResult>((r) => setTimeout(() => r(same), TIMEOUT_MS));
  const result = await Promise.race([work, timeout]);
  report(1);
  return result;
}
