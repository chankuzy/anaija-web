/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useBlobUrl } from "@/lib/chat/use-blob-url";
import { renderSticker } from "@/lib/stickers/custom";

const CHECKER = {
  backgroundImage: "conic-gradient(#2b2b2b 25%, #202020 0 50%, #2b2b2b 0 75%, #202020 0)",
  backgroundSize: "24px 24px",
} as const;

export function StickerMaker({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (b: Blob) => void }) {
  const [fit, setFit] = useState(false);
  const [round, setRound] = useState(true);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const url = useBlobUrl(blob);

  useEffect(() => {
    let dead = false;
    setErr(null);
    renderSticker(file, { fit, round })
      .then((b) => !dead && setBlob(b))
      .catch(() => !dead && setErr("That image can't be used as a sticker."));
    return () => {
      dead = true;
    };
  }, [file, fit, round]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const seg = (on: boolean) =>
    `h-9 flex-1 rounded-full text-[13px] font-bold transition-colors ${on ? "bg-white text-black" : "text-white/70 hover:text-white"}`;

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Create sticker">
      <div className="w-full max-w-sm rounded-[24px] bg-surface p-4">
        <p className="text-center text-[15px] font-bold text-fg">New sticker</p>
        <div className="mx-auto mt-3 grid aspect-square w-full max-w-[280px] place-items-center overflow-hidden rounded-2xl" style={CHECKER}>
          {url ? (
            <img src={url} alt="" draggable={false} className="size-full object-contain" />
          ) : err ? (
            <p role="alert" className="px-6 text-center text-secondary text-danger">{err}</p>
          ) : (
            <span role="status" aria-label="Loading" className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          )}
        </div>
        <div className="mt-4 flex gap-1 rounded-full bg-white/8 p-1">
          <button type="button" aria-pressed={!fit} onClick={() => setFit(false)} className={seg(!fit)}>Fill</button>
          <button type="button" aria-pressed={fit} onClick={() => setFit(true)} className={seg(fit)}>Fit</button>
          <button type="button" aria-pressed={round} onClick={() => setRound((r) => !r)} className={seg(round)}>Rounded</button>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-full bg-card-elevated text-[14px] font-bold text-fg">Cancel</button>
          <button type="button" disabled={!blob} onClick={() => blob && onSave(blob)} className="h-11 flex-1 rounded-full bg-brand text-[14px] font-extrabold text-brand-fg disabled:opacity-40">
            Save sticker
          </button>
        </div>
      </div>
    </div>
  );
}
