"use client";

import { useEffect, useState, type ReactNode } from "react";

// A milestone ring. Reserved for real goals: the stroke eases in once on mount and again whenever the value changes.
export function Ring({ value, target, size = 108, stroke = 8, children }: {
  value: number; target: number; size?: number; stroke?: number; children?: ReactNode;
}) {
  const p = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(p));
    return () => cancelAnimationFrame(id);
  }, [p]);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${value} of ${target}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="text-surface-elevated" />
        {p > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="currentColor"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - shown)}
            className="text-brand-ink transition-[stroke-dashoffset] duration-[900ms] ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
