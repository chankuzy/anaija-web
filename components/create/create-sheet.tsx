"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ContentKind } from "@/lib/create/types";

const OPTIONS: { kind: ContentKind; title: string; sub: string; icon: IconName }[] = [
  { kind: "reel", title: "Reel", sub: "Photos or a video for your followers", icon: "clapperboard" },
  { kind: "story", title: "Story", sub: "A quick moment on your story ring", icon: "gallery" },
  { kind: "listing", title: "Listing", sub: "Sell something or offer a service", icon: "bag" },
];

export function CreateSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(kind: ContentKind) {
    onClose();
    router.push(`/create/new?mode=${kind}`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Create">
      <button type="button" aria-label="Close" onClick={onClose} className="sv-overlay absolute inset-0 cursor-default bg-black/60" />
      <div
        className="sv-rise relative w-full max-w-[440px] rounded-t-[30px] bg-surface-subtle px-4 pt-3 md:rounded-[30px] md:pt-5"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <p className="px-1 pb-3 text-[18px] font-extrabold tracking-tight text-white">Create</p>
        <div className="space-y-2">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => pick(o.kind)}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-surface-interactive p-3.5 text-left transition hover:bg-surface-elevated active:scale-[0.98]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-white">
                <Icon name={o.icon} filled className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-white">{o.title}</span>
                <span className="mt-0.5 block truncate text-secondary text-white/50">{o.sub}</span>
              </span>
              <Icon name="chevronRight" className="size-5 shrink-0 text-white/35" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
