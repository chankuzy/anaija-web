"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useActivity } from "@/lib/activity/activity-context";
import { isPending, messagingApi } from "@/lib/api/messaging";
import { useAuth } from "@/lib/auth/auth-context";
import { useInterval } from "./use-interval";

type Ctx = { count: number; refresh: () => void };
const UnreadCtx = createContext<Ctx>({ count: 0, refresh: () => {} });

// Number of conversations with something unread (muted chats excluded; each message request counts once).
// Counting chats rather than messages keeps the badge small and calm. Refreshes on a slow poll while the
// tab is visible, when the tab returns, when the server announces activity, and on demand.
export function MessagesUnreadProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const enabled = status === "authed";
  const { version } = useActivity();
  const [n, setN] = useState(0);
  const busy = useRef(false);

  const refresh = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    messagingApi
      .inbox()
      .then((list) => {
        let c = 0;
        for (const x of list) {
          if (isPending(x)) c += 1;
          else if (x.unread_count > 0 && !x.is_muted) c += 1;
        }
        setN(c);
      })
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, version, refresh]);

  useInterval(
    () => {
      if (document.visibilityState === "visible") refresh();
    },
    30_000,
    enabled,
  );

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, refresh]);

  const value = useMemo<Ctx>(() => ({ count: enabled ? n : 0, refresh }), [enabled, n, refresh]);
  return <UnreadCtx.Provider value={value}>{children}</UnreadCtx.Provider>;
}

export const useMessagesUnread = () => useContext(UnreadCtx);
