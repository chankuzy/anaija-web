/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

export interface ViewerItem {
  id: number;
  kind: "image" | "video";
  url: string;
  caption: string | null;
  by: string;
  at: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function MediaViewer({ items, startId, onClose }: { items: ViewerItem[]; startId: number; onClose: () => void }) {
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((i) => i.id === startId)));
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; s0: number } | null>(null);
  const swipe = useRef(0);
  const safe = clamp(index, 0, Math.max(0, items.length - 1));
  const it = items[safe];

  const go = useCallback(
    (n: number) => {
      setZ({ s: 1, x: 0, y: 0 });
      setDx(0);
      setIndex((i) => clamp(i + n, 0, items.length - 1));
    },
    [items.length],
  );

  useEffect(() => {
    if (!it) onClose();
  }, [it, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose]);

  if (!it) return null;

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    swipe.current = 0;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d0: dist(a, b) || 1, s0: z.s };
    }
  };
  const move = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    ptrs.current.set(e.pointerId, cur);
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const s = clamp((pinch.current.s0 * dist(a, b)) / pinch.current.d0, 1, 4);
      setZ((p) => (s === 1 ? { s, x: 0, y: 0 } : { ...p, s }));
    } else if (ptrs.current.size === 1) {
      const mx = cur.x - prev.x;
      const my = cur.y - prev.y;
      if (z.s > 1) setZ((p) => ({ ...p, x: p.x + mx, y: p.y + my }));
      else {
        swipe.current += mx;
        setDx(swipe.current);
      }
    }
  };
  const up = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 0) {
      setDragging(false);
      const s = swipe.current;
      swipe.current = 0;
      setDx(0);
      if (z.s === 1 && Math.abs(s) > 70) go(s < 0 ? 1 : -1);
    }
  };
  const gestures =
    it.kind === "image"
      ? {
          onPointerDown: down,
          onPointerMove: move,
          onPointerUp: up,
          onPointerCancel: up,
          onDoubleClick: () => setZ((p) => (p.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })),
          onWheel: (e: React.WheelEvent) =>
            setZ((p) => {
              const s = clamp(p.s * (e.deltaY < 0 ? 1.12 : 0.89), 1, 4);
              return s === 1 ? { s, x: 0, y: 0 } : { ...p, s };
            }),
        }
      : {};

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(it.url);
      const b = await r.blob();
      const ext = (b.type.split("/")[1] || (it.kind === "video" ? "mp4" : "jpg")).replace("jpeg", "jpg");
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = `anaija-${it.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch {
      window.open(it.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  const when = new Date(it.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const nav = "absolute top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-white transition hover:bg-white/20 md:grid";

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="z-10 flex items-center gap-2 px-2 pb-2" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-white/10">
          <Icon name="close" className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">{it.by}</p>
          <p className="truncate text-supporting text-white/60">{when}</p>
        </div>
        <button type="button" aria-label="Download" disabled={busy} onClick={() => void download()} className="grid size-11 place-items-center rounded-full hover:bg-white/10 disabled:opacity-50">
          <Icon name="arrowDown" filled className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 select-none overflow-hidden" style={{ touchAction: "none" }} {...gestures}>
        <div className="absolute inset-0 grid place-items-center p-2">
          {it.kind === "image" ? (
            <img
              key={it.id}
              src={it.url}
              alt=""
              draggable={false}
              className={`max-h-full max-w-full object-contain ${z.s > 1 ? "cursor-grab" : "cursor-zoom-in"}`}
              style={{
                transform: `translate3d(${z.x + dx}px, ${z.y}px, 0) scale(${z.s})`,
                transition: dragging ? "none" : "transform 180ms ease",
              }}
            />
          ) : (
            <video key={it.id} src={it.url} controls autoPlay playsInline className="max-h-full max-w-full" />
          )}
        </div>
        {safe > 0 && (
          <button type="button" aria-label="Previous" onClick={() => go(-1)} className={`${nav} left-3`}>
            <Icon name="altArrowLeft" filled className="size-6" />
          </button>
        )}
        {safe < items.length - 1 && (
          <button type="button" aria-label="Next" onClick={() => go(1)} className={`${nav} right-3`}>
            <Icon name="altArrowRight" filled className="size-6" />
          </button>
        )}
      </div>

      <div className="z-10 px-4 pt-2" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        {it.caption && <p className="mb-1 line-clamp-3 text-[14px] leading-[1.4]">{it.caption}</p>}
        {items.length > 1 && <p className="text-center text-supporting font-semibold text-white/60">{safe + 1} / {items.length}</p>}
      </div>
    </div>
  );
}
