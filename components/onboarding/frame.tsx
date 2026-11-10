"use client";

import type { ReactNode } from "react";

export type Stage = "profile" | "photo" | "campus" | "discover";
const ORDER: Stage[] = ["profile", "photo", "campus", "discover"];

// One calm frame for every step: a thin progress bar, a title, then the step's own content.
export function Frame({ stage, title, sub, children }: { stage: Stage; title: ReactNode; sub?: string; children: ReactNode }) {
  const i = ORDER.indexOf(stage);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6" style={{ paddingTop: "max(env(safe-area-inset-top), 28px)", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
      <div role="progressbar" aria-label={`Step ${i + 1} of ${ORDER.length}`} aria-valuemin={1} aria-valuemax={ORDER.length} aria-valuenow={i + 1} className="flex gap-1.5">
        {ORDER.map((s, k) => (
          <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${k <= i ? "bg-fg" : "bg-surface-interactive"}`} />
        ))}
      </div>
      <div key={stage} className="sv-rise flex flex-1 flex-col pt-10">
        <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-tight text-fg">{title}</h1>
        {sub && <p className="mt-2.5 text-[15px] leading-[1.45] text-muted">{sub}</p>}
        <div className="mt-8 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export const GHOST = "h-12 w-full rounded-full text-[15px] font-semibold text-muted transition-colors hover:text-fg disabled:opacity-50";
