"use client";

import { useSyncExternalStore } from "react";

// Anything drawn over the feed (notifications panel, story viewer, share sheet) holds media here.
// While at least one hold is active, feed video and post audio are paused.
const holds = new Set<string>();
const listeners = new Set<() => void>();
let snapshot = false;

function emit() {
  const next = holds.size > 0;
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export function holdMedia(reason: string) {
  holds.add(reason);
  emit();
}
export function releaseMedia(reason: string) {
  holds.delete(reason);
  emit();
}
export const isMediaHeld = () => snapshot;
export const useMediaHeld = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    isMediaHeld,
    () => false,
  );
