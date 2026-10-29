"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { realtime } from "./client";

// Who is online right now: one Realtime presence channel, tracked only while the tab is visible.
// A singleton with delayed teardown, so React strict-mode remounts reuse the channel instead of racing it.
let online: ReadonlySet<number> = new Set();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const log = (...a: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.info("[presence]", ...a);
};

type Active = { uid: number; ch: RealtimeChannel; stop: () => void; teardown: number | null };
let active: Active | null = null;

function make(uid: number): Active | null {
  const c = realtime();
  if (!c) {
    log("no realtime client: NEXT_PUBLIC_SUPABASE_ANON_KEY missing?");
    return null;
  }
  const ch = c.channel("presence-online", { config: { presence: { key: String(uid) } } });
  let joined = false;
  let tracking = false;
  const track = () => {
    if (!joined || tracking) return;
    tracking = true;
    ch.track({ at: Date.now() })
      .then((r) => {
        log("track", r);
        if (r !== "ok") tracking = false;
      })
      .catch(() => {
        tracking = false;
      });
  };
  const untrack = () => {
    if (!tracking) return;
    tracking = false;
    void ch.untrack();
  };
  ch.on("presence", { event: "sync" }, () => {
    online = new Set(Object.keys(ch.presenceState()).map(Number).filter(Number.isFinite));
    log("online", [...online]);
    emit();
  });
  ch.subscribe((s: string, err?: Error) => {
    log("status", s, err ?? "");
    joined = s === "SUBSCRIBED";
    if (!joined) tracking = false;
    if (joined && document.visibilityState === "visible") track();
  });
  const vis = () => (document.visibilityState === "visible" ? track() : untrack());
  document.addEventListener("visibilitychange", vis);
  return {
    uid,
    ch,
    teardown: null,
    stop: () => {
      document.removeEventListener("visibilitychange", vis);
      void c.removeChannel(ch);
      online = new Set();
      emit();
    },
  };
}

export function presenceDebug() {
  return {
    started: active !== null,
    uid: active?.uid ?? null,
    channelState: active?.ch.state ?? null,
    iAmTracked: active ? Object.keys(active.ch.presenceState()).includes(String(active.uid)) : false,
    online: [...online],
  };
}
if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__presence = presenceDebug;

export function startPresence(uid: number): () => void {
  if (active && active.uid === uid) {
    if (active.teardown !== null) {
      window.clearTimeout(active.teardown);
      active.teardown = null;
    }
  } else {
    active?.stop();
    active = make(uid);
  }
  return () => {
    const a = active;
    if (!a || a.uid !== uid) return;
    a.teardown = window.setTimeout(() => {
      if (active === a) {
        a.stop();
        active = null;
      }
    }, 600);
  };
}

export function useOnline(userId: number | null | undefined): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => userId != null && online.has(userId),
    () => false,
  );
}
