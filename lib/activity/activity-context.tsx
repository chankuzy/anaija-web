"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { activityApi } from "@/lib/api/activity";
import { useAuth } from "@/lib/auth/auth-context";
import { useInterval } from "@/lib/messaging/use-interval";
import { subscribeBroadcast } from "@/lib/realtime/client";

type Ctx = {
  unseen: number; // drives the bell badge
  unread: number;
  version: number; // bumps whenever the server announces new activity
  refresh: () => void;
  clearUnseen: () => void;
};

const ActivityCtx = createContext<Ctx>({ unseen: 0, unread: 0, version: 0, refresh: () => {}, clearUnseen: () => {} });

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const enabled = status === "authed";
  const [counts, setCounts] = useState({ unseen: 0, unread: 0 });
  const [topic, setTopic] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    activityApi
      .counts()
      .then((r) => {
        setCounts({ unseen: r.unseen, unread: r.unread });
        setTopic((t) => r.topic ?? t);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);
  useInterval(refresh, topic ? 60_000 : 20_000, enabled);

  // Event names are the backend's business; listen to all of them and just re-read.
  useEffect(() => {
    if (!enabled || !topic) return;
    const off = subscribeBroadcast(topic, {
      "*": () => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          refresh();
          setVersion((v) => v + 1);
        }, 350);
      },
    });
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      off();
    };
  }, [enabled, topic, refresh]);

  const clearUnseen = useCallback(() => setCounts((c) => ({ ...c, unseen: 0 })), []);
  const value = useMemo<Ctx>(
    () => ({ unseen: enabled ? counts.unseen : 0, unread: enabled ? counts.unread : 0, version, refresh, clearUnseen }),
    [enabled, counts, version, refresh, clearUnseen],
  );
  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}

export const useActivity = () => useContext(ActivityCtx);
