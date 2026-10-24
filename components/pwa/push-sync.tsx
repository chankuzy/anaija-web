"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActivity } from "@/lib/activity/activity-context";
import { useAuth } from "@/lib/auth/auth-context";
import { emitBanner } from "@/lib/notifications/banner-bus";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { PANEL_URL, routeForPush } from "@/lib/push/route";
import { syncPush } from "@/lib/push/web-push";

type SwMessage = { type?: string; url?: string; data?: Record<string, string> };

/** Mounted once in AuthRoot: keeps this device's push token fresh, routes notification taps, feeds in-app banners, clears the app badge. */
export function PushSync() {
  const { status, user } = useAuth();
  const router = useRouter();
  const { refresh } = useActivity();
  const { show } = useNotificationsPanel();
  const uid = user ? String((user as { id?: number | string }).id ?? user.username ?? "") : "";

  useEffect(() => {
    if (status === "authed" && uid) void syncPush(uid);
  }, [status, uid]);

  // Cold start from a tap that has no specific destination: open the panel, then tidy the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("panel") !== "notifications") return;
    show();
    url.searchParams.delete("panel");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [show]);

  // Messages from the service worker while a tab is open.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as SwMessage | null;
      if (!m || typeof m !== "object") return;
      if (m.type === "anaija:navigate" && typeof m.url === "string") {
        if (m.url === PANEL_URL) show();
        else if (m.url.startsWith("/") && !m.url.startsWith("//")) router.push(m.url);
      } else if (m.type === "anaija:push") {
        refresh();
      } else if (m.type === "anaija:banner" && m.data) {
        const d = m.data;
        emitBanner({
          source: "push",
          key: d.tag || `${d.type || "n"}:${Date.now()}`,
          title: d.title || "Anaija",
          body: d.body || null,
          avatar: d.avatar || null,
          image: d.image || null,
          kind: d.share_kind || d.type,
          video: d.share_kind === "reel",
          chat: d.dest === "conversation" || d.type === "message",
          href: routeForPush(d),
        });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router, refresh, show]);

  // The app-icon badge counts notifications left in the shade; looking at the app clears it.
  useEffect(() => {
    const clear = () => {
      if (document.visibilityState === "visible") {
        (navigator as unknown as { clearAppBadge?: () => Promise<void> }).clearAppBadge?.()?.catch(() => {});
      }
    };
    clear();
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);

  return null;
}
