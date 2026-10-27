"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import type { Visibility } from "@/lib/create/types";
import { formatBytes } from "@/lib/feed/structured";
import { Switch } from "../ui";

export const INPUT =
  "h-[52px] w-full rounded-input bg-surface-subtle px-5 text-[15px] text-fg outline-none placeholder:text-muted disabled:opacity-60 [color-scheme:dark]";
export const AREA =
  "w-full resize-none rounded-input bg-surface-subtle px-5 py-4 text-[15px] leading-[1.45] text-fg outline-none placeholder:text-muted disabled:opacity-60";

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <p className="mb-2.5 mt-6 flex items-baseline gap-2 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
      {hint && <span className="font-medium normal-case tracking-normal">{hint}</span>}
    </p>
  );
}

export function Count({ n, max }: { n: number; max: number }) {
  if (n < max * 0.7) return null;
  return <p className={`mt-1.5 text-right text-supporting ${n > max ? "text-danger" : "text-muted"}`}>{n}/{max}</p>;
}

export function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-secondary disabled:opacity-60 ${on ? "bg-brand font-extrabold text-brand-fg" : "bg-surface-interactive font-bold text-fg"}`}
    >
      {children}
    </button>
  );
}

export function ToggleRow({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-fg">{label}</p>
        {sub && <p className="mt-0.5 text-supporting text-muted">{sub}</p>}
      </div>
      <Switch on={on} label={label} onChange={onChange} />
    </div>
  );
}

const VIS: [Visibility, string][] = [
  ["public", "Everyone"],
  ["followers", "Followers"],
  ["campus", "My Campus"],
];
export function VisibilityChips({ value, onChange, disabled }: { value: Visibility; onChange: (v: Visibility) => void; disabled?: boolean }) {
  return (
    <>
      <Label>Who can view this</Label>
      <div className="flex flex-wrap gap-2">
        {VIS.map(([v, l]) => (
          <Chip key={v} on={value === v} disabled={disabled} onClick={() => onChange(v)}>
            {l}
          </Chip>
        ))}
      </div>
    </>
  );
}

export function FileRow({ name, size, onRemove, disabled }: { name: string; size: number; onRemove: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-subtle px-4 py-3">
      <Icon name="copy" filled className="size-5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-fg">{name}</p>
        <p className="text-supporting text-muted">{formatBytes(size)}</p>
      </div>
      <button type="button" aria-label="Remove" disabled={disabled} onClick={onRemove} className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/8 disabled:opacity-50">
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}
