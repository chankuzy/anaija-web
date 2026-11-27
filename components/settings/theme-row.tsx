"use client";

import { Icon } from "@/components/ui/icon";
import { setPref, useThemePref, type ThemePref } from "@/lib/theme/theme";

const OPTS: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function ThemeRow() {
  const pref = useThemePref();
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <Icon name="moon" tone="violet" className="size-6 shrink-0" />
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg">Theme</span>
      <div role="radiogroup" aria-label="Theme" className="flex rounded-full bg-surface-interactive p-0.5">
        {OPTS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={pref === o.id}
            onClick={() => setPref(o.id)}
            className={`h-8 rounded-full px-3 text-secondary font-bold transition-colors ${pref === o.id ? "bg-brand text-brand-fg" : "text-muted hover:text-fg"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
