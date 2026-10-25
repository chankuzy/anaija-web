"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};
type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

// Module-level so any handler can `await confirmDialog(...)` without a hook (works from plain functions too).
let opener: ((o: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  if (opener) return opener(o);
  return Promise.resolve(typeof window !== "undefined" ? window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title) : false);
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [cur, setCur] = useState<Pending | null>(null);
  const curRef = useRef<Pending | null>(null);

  useEffect(() => {
    opener = (o) =>
      new Promise<boolean>((resolve) => {
        curRef.current?.resolve(false);
        const p: Pending = { ...o, resolve };
        curRef.current = p;
        setCur(p);
      });
    return () => {
      opener = null;
    };
  }, []);

  const done = useCallback((v: boolean) => {
    const p = curRef.current;
    if (!p) return;
    curRef.current = null;
    setCur(null);
    p.resolve(v);
  }, []);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        done(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cur, done]);

  return (
    <>
      {children}
      {cur && (
        <div className="fixed inset-0 z-[90] grid place-items-center px-6" role="alertdialog" aria-modal="true" aria-label={cur.title}>
          <button type="button" aria-label="Cancel" onClick={() => done(false)} className="sv-overlay absolute inset-0 cursor-default bg-black/60" />
          <div className="sv-rise glass relative w-full max-w-[340px] rounded-floating p-6 text-center">
            <p className="text-[18px] font-extrabold tracking-tight text-fg">{cur.title}</p>
            {cur.message && <p className="mt-2 text-secondary leading-[1.45] text-muted">{cur.message}</p>}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                autoFocus={!cur.danger}
                onClick={() => done(true)}
                className={`h-11 rounded-full text-[15px] font-extrabold transition-transform active:scale-[0.98] ${
                  cur.danger ? "bg-danger text-white" : "bg-brand text-brand-fg"
                }`}
              >
                {cur.confirmLabel ?? "Confirm"}
              </button>
              <button
                type="button"
                autoFocus={!!cur.danger}
                onClick={() => done(false)}
                className="h-11 rounded-full bg-surface-interactive text-[15px] font-bold text-fg transition-colors hover:bg-surface-elevated"
              >
                {cur.cancelLabel ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
