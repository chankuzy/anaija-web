"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import type { ContentKind } from "@/lib/create/types";

type Option = { kind: ContentKind; title: string; sub: string; icon: IconName; primary?: boolean };

// Only flows that publish end to end belong here. Document, poll, publication and announcement are added to a group
// below once their backend, renderer and viewer exist (announcements additionally gated on publisher permission).
const GROUPS: { label: string; options: Option[] }[] = [
  {
    label: "Share",
    options: [
      { kind: "reel", title: "Reel", sub: "A video, or photos for your followers", icon: "clapperboard", primary: true },
      { kind: "story", title: "Story", sub: "A quick moment that fades after a day", icon: "gallery" },
    ],
  },
  {
    label: "Sell",
    options: [{ kind: "listing", title: "Listing", sub: "A product, service, rental or request", icon: "bag" }],
  },
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
        className="sv-rise relative w-full max-w-[440px] rounded-t-[30px] bg-surface-subtle px-4 pt-3 md:rounded-[30px] md:pt-6"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <p className="px-1 pb-1 text-[20px] font-extrabold tracking-tight text-fg">Create</p>
        {GROUPS.map((g) => (
          <section key={g.label}>
            <p className="px-1 pb-2 pt-4 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{g.label}</p>
            <div className="space-y-2">
              {g.options.map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  onClick={() => pick(o.kind)}
                  className="flex w-full items-center gap-3.5 rounded-2xl bg-surface-interactive p-3.5 text-left transition hover:bg-surface-elevated active:scale-[0.98] motion-reduce:active:scale-100"
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-[14px] ${o.primary ? "bg-brand text-brand-fg" : "bg-white/[0.07] text-fg"}`}>
                    <Icon name={o.icon} filled className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-fg">{o.title}</span>
                    <span className="mt-0.5 block truncate text-secondary text-muted">{o.sub}</span>
                  </span>
                  <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
