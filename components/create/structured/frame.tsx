"use client";

import { useState, type ReactNode } from "react";
import type { StructuredPublish } from "@/lib/create/structured";
import { PrimaryButton, RoundButton, Sheet } from "../ui";

export function FormFrame({
  title,
  cta,
  ready,
  hint,
  dirty,
  pub,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  cta: string;
  ready: boolean;
  hint?: string | null;
  dirty: boolean;
  pub: StructuredPublish;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);
  const close = () => (pub.busy ? undefined : dirty ? setLeaving(true) : onClose());
  const label =
    pub.stage === "preparing" ? "Preparing…" : pub.stage === "uploading" ? `Uploading ${Math.round(pub.progress * 100)}%` : pub.stage === "saving" ? "Publishing…" : cta;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center px-3.5 pb-1.5 pt-2">
        <RoundButton icon="close" label="Close" disabled={pub.busy} onClick={close} />
        <p className="flex-1 text-center text-[17px] font-extrabold tracking-tight text-fg">{title}</p>
        <span className="size-[38px]" />
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>

      <div className="bg-bg px-4 pb-3 pt-2.5">
        {pub.stage === "uploading" && (
          <div className="mb-2.5 h-1 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(pub.progress * 100)}%` }} />
          </div>
        )}
        {pub.error ? (
          <p role="alert" className="mb-2 text-center text-secondary text-danger">
            {pub.error}
          </p>
        ) : !ready && hint ? (
          <p className="mb-2 text-center text-supporting text-muted">{hint}</p>
        ) : null}
        <PrimaryButton label={label} disabled={!ready || pub.busy} loading={false} onClick={onSubmit} className="w-full" />
      </div>

      {leaving && (
        <Sheet onClose={() => setLeaving(false)}>
          <div className="px-6 pb-3 pt-[18px] text-center">
            <p className="text-base font-bold text-fg">Discard this draft?</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.4] text-muted">Drafts of written content are not saved yet.</p>
          </div>
          <button type="button" onClick={onClose} className="w-full py-4 text-[15px] font-semibold text-danger hover:bg-white/4">
            Discard
          </button>
          <button type="button" onClick={() => setLeaving(false)} className="w-full py-4 text-[15px] font-semibold text-muted hover:bg-white/4">
            Keep editing
          </button>
          <div className="h-2" />
        </Sheet>
      )}
    </div>
  );
}
