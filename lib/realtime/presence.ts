"use client";

import { useSyncExternalStore } from "react";
import { realtime } from "./client";

// Who is online right now: one Realtime presence channel, tracked only while the tab is visible.
let online: ReadonlySet<number> = new Set();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function startPresence(uid: number): () => void {
  const c = realtime();
  if (!c) return () => {};
  const ch = c.channel("presence:online", { config: { presence: { key: String(uid) } } });
  let tracking = false;
  const track = async () => {
    if (tracking) return;
    tracking = true;
    await ch.track({ at: Date.now() });
  };
  const untrack = async () => {
    if (!tracking) return;
    tracking = false;
    await ch.untrack();
  };
  ch.on("presence", { event: "sync" }, () => {
    online = new Set(Object.keys(ch.presenceState()).map(Number).filter(Number.isFinite));
    emit();
  });
  ch.subscribe((s: string) => {
    if (s === "SUBSCRIBED" && document.visibilityState === "visible") void track();
  });
  const vis = () => (document.visibilityState === "visible" ? void track() : void untrack());
  document.addEventListener("visibilitychange", vis);
  return () => {
    document.removeEventListener("visibilitychange", vis);
    void c.removeChannel(ch);
    online = new Set();
    emit();
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
