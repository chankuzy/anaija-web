"use client";

import { useEffect } from "react";

// "(3) Anaija" in the tab title, plus the installed-PWA app icon badge where the browser supports it.
// A MutationObserver re-applies the prefix when Next swaps the title on navigation.
export function useTabBadge(total: number) {
  useEffect(() => {
    const strip = (t: string) => t.replace(/^\((?:\d+\+?)\)\s+/, "");
    const label = total > 99 ? "99+" : String(total);
    const apply = () => {
      const base = strip(document.title);
      const next = total > 0 ? `(${label}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });

    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (total > 0) nav.setAppBadge?.(total)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});

    return () => {
      mo.disconnect();
      document.title = strip(document.title);
    };
  }, [total]);
}
