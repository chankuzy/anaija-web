"use client";

import { useEffect, useRef, useState } from "react";

export interface CropSpec {
  aspect: number; // width / height
  circle: boolean;
  title: string;
  outW: number; // exported width in px
  viewW: number; // preferred on-screen crop width
}

interface View {
  s: number; // display px per image px
  x: number; // image-centre offset from viewport centre
  y: number;
}

// Port of Flutter's ImageCropScreen: the photo starts at "cover" scale, pinch/wheel/slider to zoom, drag to
// reposition, both clamped so empty space never shows. Done rasterises exactly what you see.
export function ImageCropper({
  file,
  spec,
  onCancel,
  onDone,
}: {
  file: File;
  spec: CropSpec;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [vw] = useState(() => Math.min(spec.viewW, window.innerWidth - 32));
  const vh = vw / spec.aspect;
  const [img, setImg] = useState<{ el: HTMLImageElement; url: string } | null>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const lastDist = useRef(0);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      setImg({ el, url });
      setView({ s: Math.max(vw / el.naturalWidth, vh / el.naturalHeight), x: 0, y: 0 });
    };
    el.onerror = () => setFailed(true);
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, vw, vh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const iw = img?.el.naturalWidth ?? 1;
  const ih = img?.el.naturalHeight ?? 1;
  const min = Math.max(vw / iw, vh / ih);
  const max = min * 4;

  const clamp = (s: number, x: number, y: number): View => {
    const ns = Math.min(max, Math.max(min, s));
    const mx = Math.max(0, (iw * ns - vw) / 2);
    const my = Math.max(0, (ih * ns - vh) / 2);
    return { s: ns, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastDist.current = 0;
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev || !img) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setView((v) => clamp(v.s, v.x + dx, v.y + dy));
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist.current) {
        const k = d / lastDist.current;
        setView((v) => clamp(v.s * k, v.x, v.y));
      }
      lastDist.current = d;
    }
  }
  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    ptrs.current.delete(e.pointerId);
    lastDist.current = 0;
  }

  function confirm() {
    if (!img || busy) return;
    setBusy(true);
    const k = spec.outW / vw;
    const c = document.createElement("canvas");
    c.width = spec.outW;
    c.height = Math.round(spec.outW / spec.aspect);
    const ctx = c.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(
      img.el,
      k * (vw / 2 - (iw * view.s) / 2 + view.x),
      k * (vh / 2 - (ih * view.s) / 2 + view.y),
      k * iw * view.s,
      k * ih * view.s,
    );
    c.toBlob((b) => (b ? onDone(b) : setBusy(false)), "image/jpeg", 0.86);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={spec.title}>
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={onCancel} disabled={busy} className="h-10 w-20 text-left text-[15px] font-semibold text-white/70 hover:text-white">
          Cancel
        </button>
        <h2 className="text-[15px] font-bold text-white">{spec.title}</h2>
        <button
          type="button"
          onClick={confirm}
          disabled={!img || busy}
          className="h-9 w-20 rounded-full bg-brand text-[14px] font-extrabold text-brand-fg transition disabled:opacity-40"
        >
          {busy ? "…" : "Done"}
        </button>
      </div>

      <div
        className="flex flex-1 touch-none items-center justify-center"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => img && setView((v) => clamp(v.s * (e.deltaY < 0 ? 1.06 : 0.94), v.x, v.y))}
      >
        {failed ? (
          <p className="text-body text-muted">Couldn&apos;t open that image.</p>
        ) : img ? (
          <div className="relative overflow-hidden" style={{ width: vw, height: vh }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: vw / 2 - (iw * view.s) / 2 + view.x,
                top: vh / 2 - (ih * view.s) / 2 + view.y,
                width: iw * view.s,
                height: ih * view.s,
              }}
            />
            <div
              className={`pointer-events-none absolute inset-0 ${
                spec.circle
                  ? "rounded-full ring-[1.5px] ring-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.65)]"
                  : "border-[1.5px] border-white/90 bg-[linear-gradient(to_right,transparent_33.2%,rgba(255,255,255,0.22)_33.3%,transparent_33.5%,transparent_66.5%,rgba(255,255,255,0.22)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgba(255,255,255,0.22)_33.3%,transparent_33.5%,transparent_66.5%,rgba(255,255,255,0.22)_66.6%,transparent_66.8%)]"
              }`}
            />
          </div>
        ) : (
          <span role="status" aria-label="Loading image" className="sk-block block size-64 rounded-2xl" />
        )}
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-3">
        <p className="text-secondary text-muted">Drag to reposition, pinch or scroll to zoom</p>
        <div className="flex w-full max-w-[320px] items-center gap-3">
          <input
            type="range"
            aria-label="Zoom"
            min={min}
            max={max}
            step={0.001}
            value={Math.min(max, Math.max(min, view.s))}
            disabled={!img}
            onChange={(e) => setView((v) => clamp(Number(e.target.value), v.x, v.y))}
            className="h-1 flex-1 accent-[#ffd84d]"
          />
          <button
            type="button"
            disabled={!img}
            onClick={() => setView({ s: min, x: 0, y: 0 })}
            className="text-secondary font-extrabold text-brand disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
