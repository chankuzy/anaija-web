/* eslint-disable @next/next/no-img-element */
"use client";

// Step 2 (photos only). Port of create_editor_screen.dart: right rail (Crop / Filter / Slideshow), free-form crop with
// ratio shortcuts, per-photo filters, auto-sliding multi-photo posts while no tool is open. Edits bake from the originals.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { FULL_CROP, isFullCrop, type Crop } from "@/lib/create/image-pipeline";
import { EDITOR_CROP_RATIOS, IMAGE_FILTERS, RATIO_ORIGINAL } from "@/lib/create/presets";
import type { Composer } from "@/lib/create/use-composer";
import { CropOverlay } from "./crop-overlay";
import { FilterDefs, filterCss } from "./filter-defs";
import { PrimaryButton } from "./ui";

type Tool = "crop" | "filter";
type Size = { w: number; h: number };
const PAD = 12;

const ratioFor = (idx: number, size: Size | null): number | null => {
  const r = EDITOR_CROP_RATIOS[idx].ratio;
  if (r === null) return null;
  if (r === RATIO_ORIGINAL) return size ? size.w / size.h : null;
  return r;
};

function fitRatio(ratio: number, s: Size): Crop {
  const imgAspect = s.w / s.h;
  let w: number;
  let h: number;
  if (ratio >= imgAspect) {
    w = 1;
    h = imgAspect / ratio;
  } else {
    h = 1;
    w = ratio / imgAspect;
  }
  return { left: (1 - w) / 2, top: (1 - h) / 2, right: (1 + w) / 2, bottom: (1 + h) / 2 };
}

function RailButton({ icon, label, active, onClick }: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-3.5 flex flex-col items-center">
      <span
        className={`grid size-11 place-items-center rounded-full transition-colors duration-150 ${
          active ? "bg-white text-black" : "border border-white/24 bg-black/45 text-white"
        }`}
      >
        <Icon name={icon} filled className="size-[19px]" />
      </span>
      <span className="mt-[3px] text-[10px] font-semibold text-white text-shadow">{label}</span>
    </button>
  );
}

export function EditorStep({ c, onBack, onNext }: { c: Composer; onBack: () => void; onNext: () => void }) {
  const { draft, edits, previews } = c;
  const media = draft.media;
  const n = media.length;
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool | null>(null);
  // Last opened tool: keeps the panel's content on screen while its height animates closed.
  const [lastTool, setLastTool] = useState<Tool>("crop");
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goto = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior });
  }, []);

  // Multi-photo posts slide by themselves, but never while the user is cropping/filtering.
  const sliding = n > 1 && draft.slideshow.enabled && !tool && !c.busy;
  useEffect(() => {
    if (!sliding) return;
    const t = setTimeout(() => (index >= n - 1 ? goto(0, "auto") : goto(index + 1)), draft.slideshow.intervalMs);
    return () => clearTimeout(t);
  }, [sliding, index, n, draft.slideshow.intervalMs, goto]);

  const cur = media[index] ?? media[0];
  const curEdit = cur ? edits[cur.id] : undefined;

  const toggleTool = (t: Tool) => {
    setLastTool(t);
    setTool((p) => (p === t ? null : t));
  };
  const toggleSlideshow = () => {
    const on = !draft.slideshow.enabled;
    c.update({ slideshow: { ...draft.slideshow, enabled: on } });
    c.flash("ok", on ? "Slideshow on" : "Slideshow off");
  };
  const selectRatio = (idx: number) => {
    if (!cur) return;
    const size = curEdit?.size ?? null;
    const r = ratioFor(idx, size);
    c.setEdit(cur.id, { ratioIdx: idx, ...(r !== null && size ? { crop: fitRatio(r, size) } : {}) });
  };
  const next = async () => {
    if (c.busy) return;
    if (await c.bake()) onNext();
  };

  const panel = tool ?? lastTool;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <FilterDefs />
      <div className="flex items-center px-1 pb-1 pt-1.5">
        <button type="button" aria-label="Back" disabled={c.busy} onClick={onBack} className="grid size-12 place-items-center text-white disabled:opacity-50">
          <Icon name="back" className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className={`no-scrollbar absolute inset-0 flex snap-x snap-mandatory ${tool === "crop" ? "overflow-x-hidden" : "overflow-x-auto"}`}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {media.map((m, i) => {
            const e = edits[m.id];
            const size = e?.size;
            const aw = box.w - PAD * 2;
            const ah = box.h - PAD * 2;
            const s = size && aw > 0 && ah > 0 ? Math.min(aw / size.w, ah / size.h) : 0;
            const w = size ? size.w * s : 0;
            const h = size ? size.h * s : 0;
            return (
              <div key={m.id} className="relative h-full w-full shrink-0 snap-center">
                {!size || !s ? (
                  <span className="absolute inset-0 grid place-items-center">
                    <span role="status" aria-label="Loading image" className="sk-block block size-full" />
                  </span>
                ) : (
                  <div className="absolute" style={{ left: (box.w - w) / 2, top: (box.h - h) / 2, width: w, height: h }}>
                    <img src={previews[m.id] ?? ""} alt="" draggable={false} className="size-full select-none" style={{ filter: filterCss(e.filterIdx) }} />
                    <CropOverlay
                      w={w}
                      h={h}
                      crop={e.crop}
                      ratio={ratioFor(e.ratioIdx, size)}
                      interactive={tool === "crop" && i === index}
                      onChange={(r) => c.setEdit(m.id, { crop: r })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="absolute right-2.5 top-1.5 flex flex-col">
          <RailButton icon="cropMinimalistic" label="Crop" active={tool === "crop"} onClick={() => toggleTool("crop")} />
          <RailButton icon="filters" label="Filter" active={tool === "filter"} onClick={() => toggleTool("filter")} />
          {n > 1 && <RailButton icon="gallery" label="Slideshow" active={draft.slideshow.enabled} onClick={toggleSlideshow} />}
        </div>
      </div>

      {/* tool panel (animated height) */}
      <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: tool ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          {panel === "crop" && cur && curEdit && (
            <div>
              <div className="no-scrollbar flex h-11 gap-2 overflow-x-auto px-4 py-1">
                {EDITOR_CROP_RATIOS.map((r, i) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => selectRatio(i)}
                    className={`shrink-0 rounded-full border px-3.5 text-[12px] font-bold ${
                      curEdit.ratioIdx === i ? "border-white bg-white text-black" : "border-white/24 bg-white/8 text-white"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {!isFullCrop(curEdit.crop) && (
                <button
                  type="button"
                  onClick={() => c.setEdit(cur.id, { crop: FULL_CROP, ratioIdx: 0 })}
                  className="px-4 py-2 text-[12.5px] font-bold text-white"
                >
                  Reset crop
                </button>
              )}
            </div>
          )}
          {panel === "filter" && cur && curEdit && (
            <div className="no-scrollbar flex h-[92px] gap-2.5 overflow-x-auto px-4">
              {IMAGE_FILTERS.map((f, i) => (
                <button key={f.label} type="button" onClick={() => c.setEdit(cur.id, { filterIdx: i })} className="flex shrink-0 flex-col items-center">
                  <span className={`size-[60px] overflow-hidden rounded-[10px] border-2 ${curEdit.filterIdx === i ? "border-white" : "border-transparent"}`}>
                    <img src={previews[cur.id] ?? ""} alt="" draggable={false} className="size-full rounded-[8px] object-cover" style={{ filter: filterCss(i) }} />
                  </span>
                  <span className={`mt-1 text-[10px] ${curEdit.filterIdx === i ? "font-bold text-white" : "text-white/70"}`}>{f.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {n > 1 && (
        <div className="flex h-[60px] items-center">
          <button type="button" aria-label="Back to selection" onClick={onBack} className="px-4 text-white/70">
            <Icon name="gallery" className="size-[22px]" />
          </button>
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pr-4">
            {media.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => goto(i)}
                className={`my-1 size-[52px] shrink-0 overflow-hidden rounded-[10px] ${i === index ? "border-2 border-white" : "border border-white/24"}`}
              >
                <img src={previews[m.id] ?? ""} alt="" draggable={false} className="size-full rounded-[8px] object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-3 pt-2">
        <PrimaryButton label="Next" loading={c.busy} onClick={() => void next()} className="w-full" />
      </div>
    </div>
  );
}
