"use client";

import type { ReactNode } from "react";

export type Stage = "profile" | "photo" | "campus" | "discover";
const ORDER: Stage[] = ["profile", "photo", "campus", "discover"];

// One calm frame for every step: a back chevron, yellow progress, a quiet step kicker, a title, then the content.
// The surface is the app's normal dark theme. Yellow stays on small elements so long sessions never glare.
export function Frame({ stage, title, sub, children, onBack }: { stage: Stage; title: ReactNode; sub?: string; children: ReactNode; onBack?: () => void }) {
  const i = ORDER.indexOf(stage);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 md:max-w-[480px]" style={{ paddingTop: "max(env(safe-area-inset-top), 20px)", paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
      <div className="flex h-10 items-center gap-2">
        {onBack && (
          <button type="button" aria-label="Back" onClick={onBack} className="-ml-2.5 grid size-10 shrink-0 place-items-center rounded-full text-fg transition-colors hover:bg-card">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m12 4-6 6 6 6" />
            </svg>
          </button>
        )}
        <div role="progressbar" aria-label={`Step ${i + 1} of ${ORDER.length}`} aria-valuemin={1} aria-valuemax={ORDER.length} aria-valuenow={i + 1} className="flex flex-1 gap-1.5">
          {ORDER.map((s, k) => (
            <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${k <= i ? "bg-brand" : "bg-surface-interactive"}`} />
          ))}
        </div>
      </div>
      <div key={stage} className="sv-rise flex flex-1 flex-col pt-7">
        <p className="text-micro font-semibold uppercase tracking-[0.1em] text-muted">Step {i + 1} of {ORDER.length}</p>
        <h1 className="mt-3 text-[30px] font-extrabold leading-[1.1] tracking-tight text-fg">{title}</h1>
        {sub && <p className="mt-2.5 text-[15px] leading-[1.45] text-muted">{sub}</p>}
        <div className="mt-8 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export const GHOST = "h-12 w-full rounded-full text-[15px] font-semibold text-muted transition-colors hover:text-fg disabled:opacity-50";
