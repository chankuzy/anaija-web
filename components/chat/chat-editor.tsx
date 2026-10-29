/* eslint-disable @next/next/no-img-element */
"use client";

// Edits each photo independently (rotate, free crop, filter, draw) without touching the original file.
// Nothing is exported until Done, and Cancel leaves everything exactly as it was.
import { useCallback, useEffect, useRef, useState } from "react";
import { CropOverlay } from "@/components/create/crop-overlay";
import { FilterDefs, filterCss } from "@/components/create/filter-defs";
import { Icon, type IconName } from "@/components/ui/icon";
import { FULL_CROP, isFullCrop } from "@/lib/create/image-pipeline";
import { IMAGE_FILTERS } from "@/lib/create/presets";
import { blankEdit, exportChatImage, isEditedImage, makeEditPreview, paintStroke, rotateEdit, rotatePreview, type ChatEdit, type Rotation, type Stroke } from "@/lib/chat/image-edit";
import { useBlobUrl } from "@/lib/chat/use-blob-url";
import type { PickedFile } from "@/lib/chat/types";

type Tool = "crop" | "filter" | "draw" | null;
type View = { id: string; rot: Rotation; url: string; w: number; h: number };
const COLORS = ["#FFFFFF", "#000000", "#EF4444", "#FACC15", "#22C55E", "#3B82F6"];
const PAD = 12;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function DrawLayer({ w, h, strokes, active, color, width, onStroke }: { w: number; h: number; strokes: Stroke[]; active: boolean; color: string; width: number; onStroke: (s: Stroke) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);

  const paintAll = useCallback(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of strokes) paintStroke(ctx, s, 0, 0, w, h, w);
  }, [strokes, w, h, dpr]);
  useEffect(() => {
    paintAll();
  }, [paintAll]);

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };
  const end = () => {
    const s = live.current;
    live.current = null;
    if (s) onStroke(s);
  };

  return (
    <canvas
      ref={ref}
      width={Math.max(1, Math.round(w * dpr))}
      height={Math.max(1, Math.round(h * dpr))}
      className="absolute inset-0 size-full"
      style={{ touchAction: active ? "none" : undefined, pointerEvents: active ? "auto" : "none" }}
      onPointerDown={(e) => {
        if (!active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        live.current = { color, w: width, pts: [pt(e)] };
        const ctx = ref.current?.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          paintStroke(ctx, live.current, 0, 0, w, h, w);
        }
      }}
      onPointerMove={(e) => {
        const s = live.current;
        if (!s) return;
        const prev = s.pts[s.pts.length - 1];
        const next = pt(e);
        if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) < 0.0015) return;
        s.pts.push(next);
        const ctx = ref.current?.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          paintStroke(ctx, { color: s.color, w: s.w, pts: [prev, next] }, 0, 0, w, h, w);
        }
      }}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}

function ToolBtn({ icon, label, active = false, onClick, disabled = false }: { icon: IconName; label: string; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className="flex min-w-[64px] flex-col items-center gap-1 disabled:opacity-40">
      <span className={`grid size-11 place-items-center rounded-full transition-colors ${active ? "bg-brand text-brand-fg" : "bg-white/12 text-white"}`}>
        <Icon name={icon} filled={icon !== "pen"} className="size-[19px]" />
      </span>
      <span className="text-[10.5px] font-semibold text-white">{label}</span>
    </button>
  );
}

function StripThumb({ item, active, edited, onClick, n }: { item: PickedFile; active: boolean; edited: boolean; onClick: () => void; n: number }) {
  const url = useBlobUrl(item.thumb);
  return (
    <button type="button" aria-label={`Photo ${n}`} onClick={onClick} className={`relative my-1 size-[52px] shrink-0 overflow-hidden rounded-[10px] border-2 ${active ? "border-brand" : "border-transparent"}`}>
      {url && <img src={url} alt="" draggable={false} className="size-full object-cover" />}
      {edited && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-brand" />}
    </button>
  );
}

export function ChatEditor({ items, onCancel, onDone }: { items: PickedFile[]; onCancel: () => void; onDone: (edited: Record<string, File>) => void }) {
  const [list] = useState(items);
  const [edits, setEdits] = useState<Record<string, ChatEdit>>({});
  const [bases, setBases] = useState<Record<string, Blob | null>>({});
  const [view, setView] = useState<View | null>(null);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>(null);
  const [color, setColor] = useState(COLORS[2]);
  const [thick, setThick] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const cur = list[index];
  const edit = edits[cur.id] ?? blankEdit();
  const update = useCallback((id: string, fn: (e: ChatEdit) => ChatEdit) => setEdits((m) => ({ ...m, [id]: fn(m[id] ?? blankEdit()) })), []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  // One light preview at a time (never all originals at once), so low-end phones stay responsive.
  useEffect(() => {
    let dead = false;
    (async () => {
      for (const it of list) {
        if (dead) return;
        try {
          const p = await makeEditPreview(it.original);
          if (!dead) setBases((b) => ({ ...b, [it.id]: p }));
        } catch {
          if (!dead) setBases((b) => ({ ...b, [it.id]: it.thumb ?? null }));
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [list]);

  const base = bases[cur.id];
  const rot = edit.rot;
  useEffect(() => {
    if (!base) return;
    let dead = false;
    let made: string | null = null;
    rotatePreview(base, rot)
      .then((v) => {
        if (dead) {
          URL.revokeObjectURL(v.url);
          return;
        }
        made = v.url;
        setView({ ...v, id: cur.id, rot });
      })
      .catch(() => setErr("This photo can't be previewed."));
    return () => {
      dead = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [base, rot, cur.id]);
  const v = view && view.id === cur.id && view.rot === rot ? view : null;

  const aw = box.w - PAD * 2;
  const ah = box.h - PAD * 2;
  const sc = v && aw > 0 && ah > 0 ? Math.min(aw / v.w, ah / v.h) : 0;
  const dw = v ? v.w * sc : 0;
  const dh = v ? v.h * sc : 0;

  const anyEdited = list.some((it) => isEditedImage(edits[it.id]));
  const curEdited = isEditedImage(edits[cur.id]);

  async function finish() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const out: Record<string, File> = {};
      for (const it of list) {
        const e = edits[it.id];
        if (isEditedImage(e)) out[it.id] = await exportChatImage(it.original, e);
      }
      onDone(out);
    } catch {
      setErr("Couldn't apply your edits. Try again.");
      setBusy(false);
    }
  }

  const pickTool = (t: Exclude<Tool, null>) => setTool((p) => (p === t ? null : t));

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Edit photos">
      <FilterDefs />
      <div className="flex items-center px-2 pb-1" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <button type="button" aria-label="Cancel editing" disabled={busy} onClick={onCancel} className="grid size-11 place-items-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-50">
          <Icon name="close" className="size-6" />
        </button>
        <p className="flex-1 text-center text-[14px] font-bold">{list.length > 1 ? `${index + 1} of ${list.length}` : "Edit photo"}</p>
        <button
          type="button"
          disabled={busy || !curEdited}
          onClick={() => {
            update(cur.id, () => blankEdit());
            setTool(null);
          }}
          className="h-11 rounded-full px-3 text-[13px] font-bold text-brand disabled:opacity-30"
        >
          Reset
        </button>
      </div>

      <div ref={stage} className="relative min-h-0 flex-1">
        {base === null ? (
          <p className="absolute inset-0 grid place-items-center px-8 text-center text-secondary text-white/70">This photo can&apos;t be edited. You can still send it as it is.</p>
        ) : v && sc > 0 ? (
          <div className="absolute" style={{ left: (box.w - dw) / 2, top: (box.h - dh) / 2, width: dw, height: dh }}>
            <img src={v.url} alt="" draggable={false} className="size-full select-none" style={{ filter: filterCss(edit.filterIdx) }} />
            <DrawLayer
              w={dw}
              h={dh}
              strokes={edit.strokes}
              active={tool === "draw"}
              color={color}
              width={thick * 0.0025}
              onStroke={(s) => update(cur.id, (e) => ({ ...e, strokes: [...e.strokes, s] }))}
            />
            <CropOverlay w={dw} h={dh} crop={edit.crop} ratio={null} interactive={tool === "crop"} onChange={(c) => update(cur.id, (e) => ({ ...e, crop: c }))} />
          </div>
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <span role="status" aria-label="Loading photo" className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          </span>
        )}
      </div>

      {err && <p role="alert" className="px-4 pb-1 text-center text-[12.5px] font-medium text-danger">{err}</p>}

      {tool === "crop" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <p className="text-[12.5px] text-white/70">Drag a corner to resize freely. Drag inside to move.</p>
          {!isFullCrop(edit.crop) && (
            <button type="button" onClick={() => update(cur.id, (e) => ({ ...e, crop: FULL_CROP }))} className="shrink-0 text-[12.5px] font-bold text-brand">Reset crop</button>
          )}
        </div>
      )}
      {tool === "filter" && v && (
        <div className="no-scrollbar flex h-[92px] gap-2.5 overflow-x-auto px-4">
          {IMAGE_FILTERS.map((f, i) => (
            <button key={f.label} type="button" onClick={() => update(cur.id, (e) => ({ ...e, filterIdx: i }))} className="flex shrink-0 flex-col items-center">
              <span className={`size-[60px] overflow-hidden rounded-[10px] border-2 ${edit.filterIdx === i ? "border-brand" : "border-transparent"}`}>
                <img src={v.url} alt="" draggable={false} className="size-full rounded-[8px] object-cover" style={{ filter: filterCss(i) }} />
              </span>
              <span className={`mt-1 text-[10px] ${edit.filterIdx === i ? "font-bold" : "text-white/70"}`}>{f.label}</span>
            </button>
          ))}
        </div>
      )}
      {tool === "draw" && (
        <div className="space-y-2 px-4 py-2">
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={`size-7 rounded-full border-2 ${color === c ? "border-brand" : "border-white/30"}`} style={{ background: c }} />
            ))}
            <span className="ml-auto flex gap-1">
              <button type="button" disabled={edit.strokes.length === 0} onClick={() => update(cur.id, (e) => ({ ...e, strokes: e.strokes.slice(0, -1) }))} className="h-8 rounded-full bg-white/12 px-3 text-[12.5px] font-bold disabled:opacity-35">Undo</button>
              <button type="button" disabled={edit.strokes.length === 0} onClick={() => update(cur.id, (e) => ({ ...e, strokes: [] }))} className="h-8 rounded-full bg-white/12 px-3 text-[12.5px] font-bold disabled:opacity-35">Clear</button>
            </span>
          </div>
          <label className="flex items-center gap-3 text-[12px] text-white/70">
            Thickness
            <input type="range" min={1} max={10} value={thick} onChange={(e) => setThick(Number(e.target.value))} className="flex-1" aria-label="Stroke thickness" />
          </label>
        </div>
      )}

      {list.length > 1 && (
        <div className="no-scrollbar flex h-[60px] gap-2 overflow-x-auto px-4">
          {list.map((it, i) => (
            <StripThumb key={it.id} item={it} n={i + 1} active={i === index} edited={isEditedImage(edits[it.id])} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-1">
        <div className="flex gap-1">
          <ToolBtn icon="cropMinimalistic" label="Crop" active={tool === "crop"} onClick={() => pickTool("crop")} />
          <ToolBtn icon="refresh" label="Rotate" disabled={!v} onClick={() => v && update(cur.id, (e) => rotateEdit(e, { w: v.w, h: v.h }))} />
          <ToolBtn icon="filters" label="Filters" active={tool === "filter"} onClick={() => pickTool("filter")} />
          <ToolBtn icon="pen" label="Draw" active={tool === "draw"} onClick={() => pickTool("draw")} />
        </div>
        <button type="button" disabled={busy} onClick={() => void finish()} className="h-11 min-w-[88px] rounded-full bg-brand px-6 text-[14px] font-extrabold text-brand-fg disabled:opacity-60">
          {busy ? "Applying…" : anyEdited ? "Done" : "Done"}
        </button>
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
