"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActivity } from "@/lib/activity/activity-context";
import { useAuth } from "@/lib/auth/auth-context";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { syncPush } from "@/lib/push/web-push";

const PANEL_URL = "/?panel=notifications";

export function PushSync() {
  const { status, user } = useAuth();
  const router = useRouter();
  const { refresh } = useActivity();
  const { show } = useNotificationsPanel();
  const uid = user ? String((user as { id?: number | string }).id ?? user.username ?? "") : "";

  useEffect(() => {
    if (status === "authed" && uid) void syncPush(uid);
  }, [status, uid]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("panel") !== "notifications") return;
    show();
    url.searchParams.delete("panel");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [show]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; url?: string } | null;
      if (!m || typeof m !== "object") return;
      if (m.type === "anaija:navigate" && typeof m.url === "string") {
        if (m.url === PANEL_URL) show();
        else if (m.url.startsWith("/") && !m.url.startsWith("//")) router.push(m.url);
      } else if (m.type === "anaija:push") {
        refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router, refresh, show]);

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
