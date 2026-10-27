"use client";

import { useSyncExternalStore } from "react";

// Sound for reels on Home. Independent of the saved "start muted" setting: Home always starts muted,
// and once the viewer unmutes, it stays unmuted for the rest of the session.
let muted = true;
const subs = new Set<() => void>();

export function setHomeMuted(v: boolean) {
  if (v === muted) return;
  muted = v;
  subs.forEach((f) => f());
}

export const useHomeMuted = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => muted,
    () => true,
  );
