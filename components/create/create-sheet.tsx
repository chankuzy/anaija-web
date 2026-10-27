"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { KIND_META, type CreateKind, type StructuredCreateKind, type Tone } from "@/lib/create/kinds";
import { useCapabilities } from "@/lib/create/use-capabilities";

const TONE: Record<Tone, string> = {
  brand: "bg-brand text-brand-fg",
  neutral: "bg-white/[0.07] text-fg",
  info: "bg-info/15 text-info",
  accent: "bg-accent/15 text-accent",
  warm: "bg-warm/15 text-warm",
};

function Label({ children }: { children: React.ReactNode }) {
  return <p className="px-1 pb-2 pt-5 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{children}</p>;
}

function Tile({ kind, onPick, wide = false }: { kind: CreateKind; onPick: (k: CreateKind) => void; wide?: boolean }) {
  const m = KIND_META[kind];
  return (
    <button
      type="button"
      onClick={() => onPick(kind)}
      className={`flex rounded-2xl bg-surface-interactive p-3.5 text-left transition hover:bg-surface-elevated active:scale-[0.98] motion-reduce:active:scale-100 ${
        wide ? "col-span-2 items-center gap-3.5" : "flex-col gap-3"
      }`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${TONE[m.tone]}`}>
        <Icon name={m.icon} filled className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-fg">{m.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-supporting leading-[1.35] text-muted">{m.sub}</span>
      </span>
    </button>
  );
}

// Media flows are always offered. The written / official kinds appear only when the backend says this account can
// publish them (publishing-capabilities), so nothing here can lead to a flow that will not save.
export function CreateSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { caps } = useCapabilities();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (kind: CreateKind) => {
    onClose();
    router.push(`/create/new?mode=${kind}`);
  };
  const on = (k: StructuredCreateKind) => caps?.kinds[k] === true;
  const write = (["document", "poll", "article"] as const).filter(on);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Create">
      <button type="button" aria-label="Close" onClick={onClose} className="sv-overlay absolute inset-0 cursor-default bg-black/60" />
      <div
        className="sv-rise no-scrollbar relative max-h-[90dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[30px] bg-surface-subtle px-4 pt-3 md:rounded-[30px] md:pt-6"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <p className="px-1 text-[22px] font-extrabold tracking-tight text-fg">Create</p>

        <Label>Share</Label>
        <div className="grid grid-cols-2 gap-2">
          <Tile kind="reel" wide onPick={pick} />
          <Tile kind="photo" onPick={pick} />
          <Tile kind="story" onPick={pick} />
        </div>

        <Label>Sell and publish</Label>
        <div className="grid grid-cols-2 gap-2">
          <Tile kind="listing" onPick={pick} />
          {write.map((k) => (
            <Tile key={k} kind={k} onPick={pick} />
          ))}
        </div>

        {on("announcement") && (
          <>
            <Label>Official</Label>
            <div className="grid grid-cols-2 gap-2">
              <Tile kind="announcement" wide onPick={pick} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
