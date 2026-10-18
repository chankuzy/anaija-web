"use client";

import { useSyncExternalStore } from "react";
import { socialApi } from "@/lib/api/social";

// Single source of truth for "do I follow user X" (port of follow_state_provider.dart).
let known: Record<number, boolean> = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function setFollow(id: number, v: boolean) {
  if (known[id] === v) return;
  known = { ...known, [id]: v };
  emit();
}

// Learn from list responses: only trusts `true`, never overrides something already known.
export function seedFollows(authors: ReadonlyArray<{ id: number; is_following: boolean } | null | undefined>) {
  let next: Record<number, boolean> | null = null;
  for (const a of authors) {
    if (a && a.is_following && !(a.id in known)) {
      next ??= { ...known };
      next[a.id] = true;
    }
  }
  if (next) {
    known = next;
    emit();
  }
}

export function resetFollows() {
  known = {};
  emit();
}

export function useIsFollowing(id: number | undefined, fallback: boolean): boolean {
  const v = useSyncExternalStore(
    subscribe,
    () => (id === undefined ? undefined : known[id]),
    () => undefined,
  );
  return v ?? fallback;
}

// Optimistic. Returns the confirmed state, or null if the request failed (state is rolled back).
export async function toggleFollow(id: number, current: boolean): Promise<boolean | null> {
  setFollow(id, !current);
  try {
    const r = await socialApi.toggleFollow(id);
    const following = r.following ?? r.is_following ?? !current;
    setFollow(id, following);
    return following;
  } catch {
    setFollow(id, current);
    return null;
  }
}
