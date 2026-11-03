"use client";

import { useSyncExternalStore } from "react";

// Subscribes to a CSS media query. Server and first hydration render report false, then the real value applies.
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
