/* eslint-disable @next/next/no-img-element */
"use client";

// Step 1. Port of unified_create_screen.dart. The device library grid has no web twin, so the grid IS the selection:
// files arrive via picker / drop / paste and appear as numbered tiles; tap a tile to remove it.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { maxSelection } from "@/lib/create/types";
import type { Composer } from "@/lib/create/use-composer";
import { KindSwitch } from "./kind-switch";
import { RoundButton, WhitePill } from "./ui";

type TypeFilter = "all" | "videos" | "photos";
const FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "videos", label: "Videos" },
  { id: "photos", label: "Photos" },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function PickStep({ c, onNext, onClose }: { c: Composer; onNext: () => void; onClose: () => void }) {
  const { draft, previews, addFiles } = c;
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [dragging, setDragging] = useState(false);

  const kind = draft.kind;
  const max = maxSelection(kind);
  const n = draft.media.length;
  const accept = kind === "listing" || filter === "photos" ? "image/*" : filter === "videos" ? "video/*" : "image/*,video/*";
  const totalVideo = draft.media.reduce((s, m) => s + (m.durationSeconds ?? 0), 0);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  }, [addFiles, onClose]);

  const browse = () => fileRef.current?.click();

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void addFiles([...e.dataTransfer.files]);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple={max > 1}
        hidden
        onChange={(e) => {
          void addFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {/* top bar */}
      <div className="flex h-[42px] items-center px-3.5 pb-1.5 pt-2" style={{ boxSizing: "content-box" }}>
        <RoundButton icon="close" label="Close" onClick={onClose} />
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={browse} className="flex items-center gap-0.5 rounded-full bg-card px-3.5 py-2 text-[14.5px] font-bold text-fg">
            Browse files
            <Icon name="chevronDown" className="size-[19px]" />
          </button>
        </div>
        <span className="size-[38px]" />
      </div>

      {/* kind switch */}
      <div className="px-3.5 pb-2 pt-1">
        <KindSwitch kind={kind} onChange={c.setKind} />
      </div>

      {/* filter row */}
      <div className="flex h-[34px] items-center px-[18px]">
        {kind !== "listing" &&
          FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} className="mr-5 flex flex-col items-center">
              <span className={`text-[13.5px] font-bold transition-colors ${filter === f.id ? "text-fg" : "text-muted"}`}>{f.label}</span>
              <span className={`mt-1 h-0.5 rounded-sm bg-white transition-[width] duration-200 ${filter === f.id ? "w-4" : "w-0"}`} />
            </button>
          ))}
        <span className="ml-auto text-[11.5px] text-muted">{max > 1 ? `Select up to ${max}` : "Choose one"}</span>
      </div>

      {/* grid */}
      <div className="no-scrollbar relative mt-1.5 min-h-0 flex-1 overflow-y-auto">
        {n === 0 ? (
          <button type="button" onClick={browse} className="group mx-3.5 mb-3 flex h-[calc(100%-12px)] w-[calc(100%-28px)] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/20 text-center transition-colors hover:border-white/40">
            <span className="grid size-16 place-items-center rounded-full bg-card">
              <Icon name="gallery" filled className="size-7 text-white" />
            </span>
            <span className="text-[17px] font-bold text-fg">Choose photos or videos</span>
            <span className="max-w-[260px] text-[12.5px] leading-[1.4] text-muted">
              Drop them here, paste, or browse. {kind === "story" ? "A story takes one item." : kind === "listing" ? "Up to 5 photos." : "Up to 10 photos, or videos up to 3 minutes."}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {draft.media.map((m, i) => (
              <button key={m.id} type="button" aria-label="Remove" onClick={() => c.removeMedia(m.id)} className="relative aspect-square bg-card">
                {previews[m.id] ? (
                  <img src={previews[m.id]!} alt="" draggable={false} className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-muted">
                    <Icon name="videocamera" filled className="size-6" />
                  </span>
                )}
                <span className="absolute inset-0 bg-black/40" />
                {m.type === "video" && m.durationSeconds != null && (
                  <span className="absolute bottom-[5px] left-1.5 text-[11.5px] font-bold text-white text-shadow">{fmt(m.durationSeconds)}</span>
                )}
                <span className="absolute right-[7px] top-[7px] grid size-[22px] place-items-center rounded-full border-[1.5px] border-white bg-white text-[12px] font-bold text-black">
                  {max > 1 ? i + 1 : <Icon name="check" className="size-3.5" />}
                </span>
              </button>
            ))}
            {n < max && (
              <button type="button" aria-label="Add more" onClick={browse} className="grid aspect-square place-items-center bg-card text-muted">
                <Icon name="plus" className="size-7" />
              </button>
            )}
          </div>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-[22px] border-2 border-dashed border-white/60 bg-black/60 text-[15px] font-bold text-white">
            Drop to add
          </div>
        )}
      </div>

      {/* bottom bar */}
      <div className="flex items-center justify-between border-t border-line/60 bg-bg px-4 pb-3 pt-2.5">
        <p className="text-[13.5px] font-bold text-fg">
          {n > 0 ? `${n} selected` : `Up to ${max}`}
          {totalVideo > 0 && <span className="ml-1 text-[12px] font-normal text-muted"> · {fmt(totalVideo)}</span>}
        </p>
        <WhitePill label={n > 0 && max > 1 ? `Next (${n})` : "Next"} enabled={n > 0} loading={c.busy} onClick={onNext} />
      </div>
    </div>
  );
}
