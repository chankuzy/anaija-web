"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

type Pdfjs = typeof import("pdfjs-dist");

let lib: Promise<Pdfjs> | null = null;

// Legacy build: runs on older Android WebViews and Safari versions the modern build does not support.
export function loadPdfjs(): Promise<Pdfjs> {
  lib ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    const p = m as unknown as Pdfjs;
    p.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    return p;
  });
  return lib;
}

export const isRenderCancel = (e: unknown) => (e as { name?: string } | null)?.name === "RenderingCancelledException";

interface Entry {
  doc: Promise<PDFDocumentProxy>;
  refs: number;
  timer: number | null;
  destroy: () => void;
}
const open = new Map<string, Entry>();
const LINGER_MS = 4000; // survives a quick unmount/remount (StrictMode, scrolling back) without refetching

/** Ref-counted document handle. Range requests only: the file is never preloaded in full. */
export function acquirePdf(url: string): { doc: Promise<PDFDocumentProxy>; release: () => void } {
  let e = open.get(url);
  if (!e) {
    let destroyTask: () => void = () => {};
    const doc = loadPdfjs().then((p) => {
      const task = p.getDocument({ url, disableAutoFetch: true });
      destroyTask = () => void task.destroy();
      return task.promise;
    });
    const created: Entry = { doc, refs: 0, timer: null, destroy: () => destroyTask() };
    doc.catch(() => {
      if (open.get(url) === created) open.delete(url);
    });
    open.set(url, created);
    e = created;
  }
  const entry = e;
  if (entry.timer !== null) {
    window.clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.refs++;
  let done = false;
  return {
    doc: entry.doc,
    release() {
      if (done) return;
      done = true;
      entry.refs--;
      if (entry.refs > 0) return;
      entry.timer = window.setTimeout(() => {
        if (entry.refs > 0) return;
        if (open.get(url) === entry) open.delete(url);
        entry.destroy();
      }, LINGER_MS);
    },
  };
}
