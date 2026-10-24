"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 64;
const MAX = 96;
const HOLD = 48;
const MIN_SPIN_MS = 700;

// Native-style pull-to-refresh for a page that scrolls the window. Touch only; does nothing on desktop.
// The pull is damped, the page does not move (an indicator drops in instead), and the refresh always
// spins for a beat so it never looks like nothing happened.
export function usePullRefresh({ onRefresh, enabled = true }: { onRefresh: () => void | Promise<unknown>; enabled?: boolean }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const cb = useRef(onRefresh);
  const busy = useRef(false);
  useEffect(() => {
    cb.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;
    let dist = 0;
    const atTop = () => window.scrollY <= 0;

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || !atTop()) {
        startY = null;
        return;
      }
      startY = e.touches[0].clientY;
      dist = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || !atTop()) {
        if (dist > 0) {
          dist = 0;
          setPull(0);
        }
        return;
      }
      dist = Math.min(MAX, dy * 0.5);
      if (e.cancelable) e.preventDefault();
      setPull(dist);
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      if (dist >= THRESHOLD && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        setPull(HOLD);
        const started = Date.now();
        Promise.resolve(cb.current())
          .catch(() => {})
          .then(() => new Promise((r) => window.setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - started)))))
          .finally(() => {
            busy.current = false;
            setRefreshing(false);
            setPull(0);
          });
      } else {
        setPull(0);
      }
      dist = 0;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  return { pull, refreshing };
}
