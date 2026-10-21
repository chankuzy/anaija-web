"use client";

import { useEffect, useRef } from "react";

// Runs cb every `ms` while the tab is visible, and once more whenever the tab becomes visible again.
export function useInterval(cb: () => void, ms: number, enabled: boolean) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const t = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms, enabled]);
}
