"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Native scroll-snap pager. Swiping is the browser's own gesture. Only the active pane sets the height;
// neighbours are clipped to it while dragging, so differing content lengths never cause a jump.
export function TabPager({ index, count, onChange, onProgress, render }: {
  index: number;
  count: number;
  onChange: (i: number) => void;
  onProgress: (p: number) => void;
  render: (i: number) => ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const inners = useRef<(HTMLDivElement | null)[]>([]);
  const settled = useRef(index);
  const timer = useRef<number | undefined>(undefined);
  const first = useRef(true);
  const [h, setH] = useState<number | null>(null);
  const [seen, setSeen] = useState<number[]>([index]);

  // Follow the controlled index (tab tap, URL).
  useEffect(() => {
    settled.current = index;
    setSeen((s) => (s.includes(index) ? s : [...s, index]));
    const el = wrap.current;
    if (!el) return;
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 1) {
      el.scrollTo({ left: target, behavior: first.current ? "auto" : "smooth" });
    }
    first.current = false;
  }, [index]);

  // The wrapper is exactly as tall as the active pane.
  useLayoutEffect(() => {
    const el = inners.current[index];
    if (!el) return;
    const measure = () => setH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onScroll = () => {
    const el = wrap.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const p = el.scrollLeft / w;
    onProgress(p);
    const lo = Math.max(0, Math.floor(p));
    const hi = Math.min(count - 1, Math.ceil(p));
    setSeen((s) => (s.includes(lo) && s.includes(hi) ? s : [...new Set([...s, lo, hi])]));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const i = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / w)));
      if (i !== settled.current) {
        settled.current = i;
        onChange(i);
      }
    }, 100);
  };

  return (
    <div
      ref={wrap}
      onScroll={onScroll}
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain"
      style={{ height: h ?? undefined }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="w-full shrink-0 snap-start snap-always"
          style={i === index ? undefined : { maxHeight: h ?? undefined, overflow: "hidden" }}
          aria-hidden={i !== index}
        >
          <div ref={(el) => { inners.current[i] = el; }} className="min-h-[60dvh] px-4 pt-4">
            {seen.includes(i) ? render(i) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
