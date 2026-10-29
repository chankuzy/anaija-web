"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";

// Moving between screens inside the app never produces a document the service worker can keep, so a chat you
// opened by tapping would not open offline after a restart. This saves the HTML of the screens that matter, once
// they have been on screen for a moment. Same-origin, small, wiped on sign-out with the rest of the page cache.
const PAGES = "anaija-pages-v4"; // keep in step with VERSION in public/sw.js
const WORTH = [/^\/$/, /^\/messages(\/\d+)?$/, /^\/communities$/, /^\/c\/[^/]+(\/chat)?$/, /^\/me$/, /^\/discover$/];

export function PageWarmer() {
  const path = usePathname();
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "authed" || !WORTH.some((r) => r.test(path))) return;
    if (!("caches" in window) || !navigator.onLine) return;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(path, { headers: { Accept: "text/html" }, credentials: "same-origin", cache: "no-store" });
        if (!res.ok || res.redirected || !(res.headers.get("content-type") ?? "").includes("text/html")) return;
        await (await caches.open(PAGES)).put(new Request(path), res);
      } catch {
        /* offline caching is best effort */
      }
    }, 2500);
    return () => window.clearTimeout(t);
  }, [path, status]);
  return null;
}
