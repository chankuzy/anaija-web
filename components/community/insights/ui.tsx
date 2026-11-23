"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { fmt } from "@/lib/community/insights/model";

// One constant, so a chart-style glyph can replace it if the icon map gains one.
export const INSIGHTS_ICON: IconName = "feed";

export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-line bg-surface-subtle p-4 ${className}`.trim()}>{children}</section>;
}

export function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2 px-0.5">
      <h2 className="text-[15px] font-extrabold tracking-tight text-fg">{title}</h2>
      {hint && <span className="text-supporting text-muted">{hint}</span>}
    </div>
  );
}

export function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface-subtle px-4 py-3.5">
      <p className="text-supporting font-semibold text-muted">{label}</p>
      <p className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-fg">{value}</p>
      {sub && <div className="mt-2 text-supporting leading-[1.35] text-muted">{sub}</div>}
    </div>
  );
}

export function Delta({ cur, prev, enabled }: { cur: number; prev: number; enabled: boolean }) {
  if (!enabled) return <span>Comparison starts after 60 days</span>;
  const d = cur - prev;
  if (d === 0) return <span>Same as last month</span>;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${d > 0 ? "text-brand-ink" : "text-muted"}`}>
      <Icon name="back" className={`size-3.5 ${d > 0 ? "rotate-90" : "-rotate-90"}`} />
      {fmt(Math.abs(d))} {d > 0 ? "more" : "fewer"} than last month
    </span>
  );
}

export function Bar({ value, total }: { value: number; total: number }) {
  const target = total > 0 ? Math.min(100, (100 * value) / total) : 0;
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
      <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${w}%` }} />
    </div>
  );
}

/** Compact column trend. Oldest first; the latest column is the accent. */
export function Bars({ data, label, caption }: { data: number[]; label: string; caption: [string, string] }) {
  const max = Math.max(1, ...data);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div>
      <div role="img" aria-label={label} className="flex h-16 items-end gap-1">
        {data.map((n, k) => (
          <span
            key={k}
            title={String(n)}
            className={`flex-1 rounded-t-[3px] transition-[height] duration-500 ease-out motion-reduce:transition-none ${k === data.length - 1 ? "bg-brand" : "bg-fg/25"}`}
            style={{ height: on ? `${Math.max(n > 0 ? 8 : 3, Math.round((100 * n) / max))}%` : "3%" }}
          />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between text-micro text-muted"><span>{caption[0]}</span><span>{caption[1]}</span></p>
    </div>
  );
}

export function Row({ label, sub, value }: { label: string; sub?: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-3">
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg">
        {label}
        {sub && <span className="mt-0.5 block text-supporting font-normal text-muted">{sub}</span>}
      </span>
      <span className="text-[17px] font-extrabold tabular-nums text-fg">{value}</span>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="px-1 text-supporting leading-[1.5] text-muted">{children}</p>;
}
