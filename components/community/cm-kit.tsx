"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

// Token-based twins of settings-kit's useToast / Group / Toggle (which hardcode white and only work on dark).
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const toast = msg ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center">
      <span className="rounded-full bg-black/85 px-4 py-2 text-secondary font-bold text-white shadow-lg">{msg}</span>
    </div>
  ) : null;
  return { toast, show };
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[20px] bg-surface-interactive/60">{children}</div>;
}

export function Toggle({ icon, label, value, onChange, disabled = false }: {
  icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <Icon name={icon} className="size-6 shrink-0 text-fg/70" />
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${value ? "bg-brand" : "bg-surface-elevated"}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full transition-all ${value ? "left-[22px] bg-brand-fg" : "left-0.5 bg-white shadow"}`} />
      </button>
    </div>
  );
}
