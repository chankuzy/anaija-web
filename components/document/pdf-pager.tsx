/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { acquirePdf } from "@/lib/documents/pdf";
import { PdfPageCanvas } from "./pdf-page";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// In-feed document: real pages, swipeable like an image carousel. The file is only opened while the post is near the
// viewport, and only the current page +/- 1 holds a canvas.
export function PdfPager({ url, coverUrl, label, onOpen }: { url: string; coverUrl?: string | null; label: string; onOpen: (page: number) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const [near, setNear] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [meta, setMeta] = useState<{ pages: number; aspect: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [cur, setCur] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(!!e?.isIntersecting), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let off = false;
    const h = acquirePdf(url);
    h.doc
      .then(async (d) => {
        const p = await d.getPage(1);
        const v = p.getViewport({ scale: 1 });
        p.cleanup();
        if (off) return;
        setMeta({ pages: d.numPages, aspect: v.width / v.height });
        setDoc(d);
      })
      .catch(() => {
        if (!off) setFailed(true);
      });
    return () => {
      off = true;
      setDoc(null);
      h.release();
    };
  }, [url, near, attempt]);

  const ready = meta !== null;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const onScroll = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = scroller.current;
      if (el?.clientWidth) setCur(Math.round(el.scrollLeft / el.clientWidth));
    });
  }, []);
  const go = (d: number) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth, behavior: "smooth" });

  const aspect = meta ? clamp(meta.aspect, 0.8, 1.78) : 0.8;
  return (
    <div ref={frame} className="relative overflow-hidden rounded-image bg-surface-subtle" style={{ aspectRatio: String(aspect) }}>
      {!meta && coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 size-full object-contain opacity-60" />}
      {!meta && !failed && (
        <div className="absolute inset-0 grid place-items-center">
          <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-current/25 border-t-current text-muted" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <p className="text-secondary font-semibold text-fg">Couldn&apos;t load this {label}</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              className="mt-2 text-secondary font-bold text-brand"
            >
              Try again
            </button>
          </div>
        </div>
      )}
      {meta && (
        <div
          ref={scroller}
          onScroll={onScroll}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
          className="flex size-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {Array.from({ length: meta.pages }, (_, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`Page ${i + 1} of ${meta.pages}. Open ${label}`}
              onClick={() => onOpen(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(i);
              }}
              className="relative grid size-full shrink-0 cursor-pointer snap-center snap-always place-items-center"
            >
              {doc && <PdfPageCanvas doc={doc} n={i + 1} active={Math.abs(i - cur) <= 1} width={size.w} height={size.h} />}
            </div>
          ))}
        </div>
      )}
      {meta && meta.pages > 1 && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-pill bg-black/55 px-2.5 py-1 text-micro font-semibold text-white">
          {cur + 1} / {meta.pages}
        </span>
      )}
      {meta && meta.pages > 1 && (
        <>
          {cur > 0 && (
            <button type="button" aria-label="Previous page" onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white md:grid">
              <span aria-hidden>‹</span>
            </button>
          )}
          {cur < meta.pages - 1 && (
            <button type="button" aria-label="Next page" onClick={() => go(1)} className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white md:grid">
              <span aria-hidden>›</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
