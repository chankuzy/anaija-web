"use client";

import type { ContentKind } from "@/lib/create/types";
import { KIND_TABS } from "@/lib/create/use-composer";

export function KindSwitch({
  kind,
  onChange,
  disabled = false,
}: {
  kind: ContentKind;
  onChange: (kind: ContentKind) => void;
  disabled?: boolean;
}) {
  const idx = Math.max(0, KIND_TABS.findIndex((k) => k.id === kind));
  return (
    <div className="relative flex h-10 rounded-full bg-card p-[3px]">
      <span
        className="absolute inset-y-[3px] rounded-full bg-white transition-[left] duration-300 ease-out"
        style={{ width: `calc((100% - 6px) / ${KIND_TABS.length})`, left: `calc(3px + ${idx} * (100% - 6px) / ${KIND_TABS.length})` }}
      />
      {KIND_TABS.map((k) => (
        <button
          key={k.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(k.id)}
          className={`relative z-10 flex-1 text-[13px] font-bold transition-colors duration-200 ${k.id === kind ? "text-black" : "text-muted"}`}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
