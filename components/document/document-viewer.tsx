"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Icon } from "@/components/ui/icon";
import { acquirePdf } from "@/lib/documents/pdf";
import { PdfPageCanvas } from "./pdf-page";

const MAX_ZOOM = 5;
const TAP_ZOOM = 2.5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function ZoomPage({ doc, n, current, near, zoomed, width, height, onZoom }: {
  doc: PDFDocumentProxy;
  n: number;
  current: boolean;
  near: boolean;
  zoomed: boolean;
  width: number;
  height: number;
  onZoom: (z: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const t = useRef({ s: 1, x: 0, y: 0 });
  const timer = useRef(0);
  const live = useRef({ current, onZoom, width, height });
  const [quality, setQuality] = useState(1);

  useEffect(() => {
    live.current = { current, onZoom, width, height };
  });

  const apply = useCallback((animate: boolean) => {
    const el = layer.current;
    if (!el) return;
    const { s, x, y } = t.current;
    el.style.transition = animate ? "transform 180ms ease-out" : "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const local = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top };
    };
    const limit = () => {
      const { width: W, height: H } = live.current;
      const c = layer.current?.querySelector("canvas");
      const bx = Math.max(0, ((c?.offsetWidth || W) * t.current.s - W) / 2);
      const by = Math.max(0, ((c?.offsetHeight || H) * t.current.s - H) / 2);
      t.current.x = clamp(t.current.x, -bx, bx);
      t.current.y = clamp(t.current.y, -by, by);
    };
    const zoomTo = (ns: number, fx: number, fy: number) => {
      const v = t.current;
      const cx = live.current.width / 2;
      const cy = live.current.height / 2;
      const s = clamp(ns, 1, MAX_ZOOM);
      v.x = fx - cx - (s * (fx - cx - v.x)) / v.s;
      v.y = fy - cy - (s * (fy - cy - v.y)) / v.s;
      v.s = s;
      if (s <= 1.001) Object.assign(v, { s: 1, x: 0, y: 0 });
      limit();
    };
    const report = () => {
      if (live.current.current) live.current.onZoom(t.current.s > 1.01);
    };
    const settle = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setQuality(clamp(Math.ceil(t.current.s), 1, 3)), 220);
    };
    const finish = () => {
      apply(true);
      report();
      settle();
    };

    let mode: "none" | "pan" | "pinch" = "none";
    let d0 = 1;
    let s0 = 1;
    let lx = 0;
    let ly = 0;
    let moved = 0;
    let lastTap = 0;
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        mode = "pinch";
        d0 = dist(e.touches[0], e.touches[1]) || 1;
        s0 = t.current.s;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        lx = e.touches[0].clientX;
        ly = e.touches[0].clientY;
        moved = 0;
        mode = t.current.s > 1 ? "pan" : "none";
      }
    };
    const onMove = (e: TouchEvent) => {
      if (mode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const f = local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        zoomTo((s0 * dist(a, b)) / d0, f.x, f.y);
        apply(false);
        return;
      }
      if (e.touches.length !== 1) return;
      const p = e.touches[0];
      const dx = p.clientX - lx;
      const dy = p.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      if (mode === "pan") {
        e.preventDefault();
        t.current.x += dx;
        t.current.y += dy;
        limit();
        apply(false);
      }
      lx = p.clientX;
      ly = p.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === "pinch" && e.touches.length < 2) {
        mode = e.touches.length === 1 && t.current.s > 1 ? "pan" : "none";
        if (e.touches.length === 1) {
          lx = e.touches[0].clientX;
          ly = e.touches[0].clientY;
        }
        finish();
        return;
      }
      if (e.touches.length > 0) return;
      if (moved < 12 && e.changedTouches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300) {
          const p = e.changedTouches[0];
          const f = local(p.clientX, p.clientY);
          zoomTo(t.current.s > 1.01 ? 1 : TAP_ZOOM, f.x, f.y);
          lastTap = 0;
        } else lastTap = now;
      }
      mode = "none";
      finish();
    };

    const onDbl = (e: MouseEvent) => {
      const f = local(e.clientX, e.clientY);
      zoomTo(t.current.s > 1.01 ? 1 : TAP_ZOOM, f.x, f.y);
      finish();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const f = local(e.clientX, e.clientY);
        zoomTo(t.current.s * Math.exp(-e.deltaY * 0.01), f.x, f.y);
      } else if (t.current.s > 1) {
        e.preventDefault();
        t.current.x -= e.deltaX;
        t.current.y -= e.deltaY;
        limit();
      } else return;
      apply(false);
      report();
      settle();
    };
    let drag: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || t.current.s <= 1) return;
      drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const onDrag = (e: PointerEvent) => {
      if (!drag) return;
      t.current.x += e.clientX - drag.x;
      t.current.y += e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      limit();
      apply(false);
    };
    const onUp = () => {
      drag = null;
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onDrag);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      window.clearTimeout(timer.current);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onDrag);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [apply]);

  useEffect(() => {
    if (current || (t.current.s === 1 && t.current.x === 0 && t.current.y === 0)) return;
    Object.assign(t.current, { s: 1, x: 0, y: 0 });
    apply(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQuality(1), 0);
  }, [current, apply]);

  return (
    <div
      ref={host}
      className="relative grid size-full shrink-0 snap-center snap-always place-items-center overflow-hidden"
      style={{ touchAction: current && zoomed ? "none" : "pan-x" }}
    >
      <div ref={layer} className="grid size-full place-items-center will-change-transform">
        <PdfPageCanvas doc={doc} n={n} active={near} width={width} height={height} quality={quality} />
      </div>
    </div>
  );
}

export function DocumentViewer({ url, title, startPage = 0, onClose }: { url: string; title: string; startPage?: number; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const started = useRef(false);
  const closeRef = useRef(onClose);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cur, setCur] = useState(startPage);
  const [zoomed, setZoomed] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pages = doc?.numPages ?? 0;

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    let off = false;
    const h = acquirePdf(url);
    h.doc
      .then((d) => {
        if (!off) setDoc(d);
      })
      .catch(() => {
        if (!off) setFailed(true);
      });
    return () => {
      off = true;
      h.release();
    };
  }, [url, attempt]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let pushed = false;
    let popped = false;
    const tid = window.setTimeout(() => {
      history.pushState({ anaijaDoc: true }, "");
      pushed = true;
    }, 0);
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    const go = (d: number) => scroller.current?.scrollBy({ left: d * scroller.current.clientWidth, behavior: "smooth" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(tid);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (pushed && !popped) history.back();
    };
  }, []);

  const ready = pages > 0;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || started.current || !pages || !size.w) return;
    started.current = true;
    el.scrollLeft = clamp(startPage, 0, pages - 1) * el.clientWidth;
  }, [pages, size.w, startPage]);

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

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] bg-black text-white">
      {ready && (
        <div
          ref={scroller}
          onScroll={onScroll}
          className={`flex size-full snap-x snap-mandatory overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            zoomed ? "overflow-x-hidden" : "overflow-x-auto"
          } overflow-y-hidden`}
          style={{ paddingTop: "calc(56px + env(safe-area-inset-top))", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {doc &&
            Array.from({ length: pages }, (_, i) => (
              <ZoomPage key={i} doc={doc} n={i + 1} current={i === cur} near={Math.abs(i - cur) <= 1} zoomed={zoomed} width={size.w} height={size.h} onZoom={setZoomed} />
            ))}
        </div>
      )}

      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center">
          <span aria-hidden className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <p className="text-[17px] font-bold">Couldn&apos;t load this document</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              className="mt-3 h-10 rounded-pill bg-white/15 px-5 text-secondary font-bold"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <button type="button" aria-label="Close" onClick={onClose} className="pointer-events-auto grid size-10 shrink-0 place-items-center rounded-full bg-black/55">
          <Icon name="close" className="size-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-secondary font-semibold">{title}</span>
        {pages > 0 && <span className="shrink-0 rounded-pill bg-black/55 px-2.5 py-1 text-micro font-semibold">{cur + 1} / {pages}</span>}
      </div>

      {pages > 1 && !zoomed && (
        <>
          {cur > 0 && (
            <button type="button" aria-label="Previous page" onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 md:grid">
              <span aria-hidden>‹</span>
            </button>
          )}
          {cur < pages - 1 && (
            <button type="button" aria-label="Next page" onClick={() => go(1)} className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 md:grid">
              <span aria-hidden>›</span>
            </button>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
