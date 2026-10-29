"use client";

import { useEffect } from "react";

// Dev-only diagnostics. Off in production builds unless NEXT_PUBLIC_PERF=1 (use that for a real-device run).
// Console: __perf() prints p50/p95/max per metric plus commit counts, __perfReset() clears them.
export const PERF = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_PERF === "1";

const marks = new Map<string, number>();
const samples = new Map<string, { unit: string; v: number[] }>();
const renders = new Map<string, number>();

export function sample(label: string, value: number, unit = "ms") {
  if (!PERF) return;
  const e = samples.get(label) ?? { unit, v: [] };
  e.v.push(value);
  samples.set(label, e);
  console.info(`[perf] ${label}: ${value.toFixed(unit === "%" ? 1 : 0)}${unit}`);
}

export function mark(key: string) {
  if (PERF) marks.set(key, performance.now());
}

export function measure(label: string, key: string) {
  if (!PERF) return;
  const t = marks.get(key);
  if (t === undefined) return;
  marks.delete(key);
  sample(label, performance.now() - t);
}

// Counts committed renders of a component (strict mode doubles these in dev; use a production build for baselines).
export function useRenders(name: string) {
  useEffect(() => {
    if (PERF) renders.set(name, (renders.get(name) ?? 0) + 1);
  });
}

// Percentage of frames dropped while an element scrolls (assumes ~60Hz; anything over 24ms counts as a drop).
export function trackScroll(el: HTMLElement | null): () => void {
  if (!PERF || !el) return () => {};
  let raf = 0;
  let last = 0;
  let frames = 0;
  let dropped = 0;
  let idle = 0;
  let active = false;
  const loop = (t: number) => {
    if (last) {
      frames += 1;
      const d = t - last;
      if (d > 24) dropped += Math.max(1, Math.round(d / 16.7) - 1);
    }
    last = t;
    raf = requestAnimationFrame(loop);
  };
  const end = () => {
    cancelAnimationFrame(raf);
    active = false;
    if (frames >= 10) sample("scroll dropped frames", (100 * dropped) / (frames + dropped), "%");
  };
  const onScroll = () => {
    if (!active) {
      active = true;
      last = 0;
      frames = 0;
      dropped = 0;
      raf = requestAnimationFrame(loop);
    }
    window.clearTimeout(idle);
    idle = window.setTimeout(end, 160);
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    el.removeEventListener("scroll", onScroll);
    window.clearTimeout(idle);
    cancelAnimationFrame(raf);
  };
}

export function perfReport() {
  const out: Record<string, unknown> = {};
  samples.forEach((e, k) => {
    const v = [...e.v].sort((a, b) => a - b);
    const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    out[k] = { n: v.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +v[v.length - 1].toFixed(1), unit: e.unit };
  });
  out["renders (commits)"] = Object.fromEntries(renders);
  return out;
}

if (PERF && typeof window !== "undefined") {
  const w = window as unknown as Record<string, unknown>;
  w.__perf = perfReport;
  w.__perfReset = () => {
    samples.clear();
    renders.clear();
    marks.clear();
  };
}
