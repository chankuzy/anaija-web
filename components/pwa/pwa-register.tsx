"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (in dev it would serve stale assets). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    // Ask the browser not to evict our IndexedDB (cached chats, inbox, feeds) when storage runs low.
    void navigator.storage?.persist?.().catch(() => {});
  }, []);
  return null;
}
