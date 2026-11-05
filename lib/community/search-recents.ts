"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { hydrate, peek, put, subscribeKey } from "@/lib/cache/swr";

// Recent community searches. Same persistent store as lib/community/recent.ts: paints at once, works offline,
// wiped on sign-out with everything else.
const KEY = "cm:search-recents";
const MAX = 8;
const read = () => peek<string[]>(KEY)?.data ?? [];

export function addSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  put(KEY, [t, ...read().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX));
}

export const removeSearch = (term: string) => put(KEY, read().filter((x) => x !== term));
export const clearSearches = () => put(KEY, []);

export function useSearches(): string[] {
  const sub = useCallback((cb: () => void) => subscribeKey(KEY, cb), []);
  const e = useSyncExternalStore(sub, () => peek<string[]>(KEY), () => undefined);
  useEffect(() => {
    void hydrate(KEY);
  }, []);
  return e?.data ?? [];
}
