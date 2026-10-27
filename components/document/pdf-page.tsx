"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { isRenderCancel } from "@/lib/documents/pdf";

const MAX_PIXELS = 12_000_000; // caps canvas memory when zoomed

interface Props {
  doc: PDFDocumentProxy;
  n: number;
  width: number;
  height: number;
  quality?: number;
}

// Renders into an offscreen buffer and swaps it in, so a quality upgrade (after zoom) never flashes blank.
function Inner({ doc, n, width, height, quality = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const visible = ref.current;
    if (!visible) return;
    let off = false;
    let page: PDFPageProxy | null = null;
    let task: RenderTask | null = null;
    const buf = document.createElement("canvas");
    (async () => {
      try {
        page = await doc.getPage(n);
        if (off) return;
        const base = page.getViewport({ scale: 1 });
        const fit = Math.min(width / base.width, height / base.height);
        let scale = fit * Math.min(window.devicePixelRatio || 1, 2) * quality;
        const px = base.width * base.height * scale * scale;
        if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px);
        const vp = page.getViewport({ scale });
        buf.width = Math.floor(vp.width);
        buf.height = Math.floor(vp.height);
        const ctx = buf.getContext("2d");
        if (!ctx) throw new Error("No 2D context");
        task = page.render({ canvas: buf, canvasContext: ctx, viewport: vp });
        await task.promise;
        if (off) return;
        visible.width = buf.width;
        visible.height = buf.height;
        visible.style.width = `${base.width * fit}px`;
        visible.style.height = `${base.height * fit}px`;
        visible.getContext("2d")?.drawImage(buf, 0, 0);
        setState("done");
      } catch (e) {
        if (!off && !isRenderCancel(e)) setState("error");
      } finally {
        buf.width = 0;
        buf.height = 0;
      }
    })();
    return () => {
      off = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [doc, n, width, height, quality]);

  return (
    <>
      <canvas ref={ref} className={`bg-white transition-opacity duration-150 ${state === "done" ? "opacity-100" : "opacity-0"}`} />
      {state === "loading" && (
        <span aria-hidden className="absolute size-6 animate-spin rounded-full border-2 border-current/25 border-t-current text-muted" />
      )}
      {state === "error" && <span className="absolute px-4 text-center text-secondary text-muted">This page couldn&apos;t be shown</span>}
    </>
  );
}

// Inactive pages unmount entirely, so their canvases are released.
export function PdfPageCanvas({ active, ...rest }: Props & { active: boolean }) {
  return active && rest.width > 0 && rest.height > 0 ? <Inner {...rest} /> : null;
}
