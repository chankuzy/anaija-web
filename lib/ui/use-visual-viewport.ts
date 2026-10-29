"use client";

import { useEffect, useState } from "react";

// Tracks the visual viewport so a full-screen chat rides above the software keyboard (iOS, and Android browsers
// without interactive-widget support). Updates are coalesced to one per frame.
export function useViewport() {
  const [v, setV] = useState<{ h: number; t: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const h = Math.round(vv.height);
      const t = Math.round(vv.offsetTop);
      setV((p) => (p && p.h === h && p.t === t ? p : { h, t }));
    };
    const update = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return v;
}

// The page behind a full-screen mobile chat must not scroll.
export function useLockScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || !window.matchMedia("(max-width: 767px)").matches) return;
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, [enabled]);
}
