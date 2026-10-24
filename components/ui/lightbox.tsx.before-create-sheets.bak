/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect } from "react";
import { Icon } from "./icon";

export function Lightbox({ url, round = false, onClose }: { url: string; round?: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4" onClick={onClose}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-3 grid size-10 place-items-center rounded-full border border-white/12 bg-black/40 text-white"
        style={{ top: "calc(12px + env(safe-area-inset-top))" }}
      >
        <Icon name="close" className="size-5" />
      </button>
      <img
        src={url}
        alt=""
        className={round ? "aspect-square w-[min(85vw,420px)] rounded-full object-cover" : "max-h-[85dvh] max-w-full object-contain"}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
