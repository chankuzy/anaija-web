"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { hydrate, peek, put, subscribeKey } from "@/lib/cache/swr";

// Recently viewed communities. Rides the persistent SWR store, so it paints instantly, works offline
// and is wiped on sign-out with everything else (nothing leaks across accounts).
const KEY = "cm:recent";
export interface Recent { slug: string; name: string; avatar: string | null }

export function noteVisit(c: Recent) {
  const cur = peek<Recent[]>(KEY)?.data ?? [];
  put(KEY, [{ slug: c.slug, name: c.name, avatar: c.avatar }, ...cur.filter((x) => x.slug !== c.slug)].slice(0, 8));
}

export function useRecent(): Recent[] {
  const sub = useCallback((cb: () => void) => subscribeKey(KEY, cb), []);
  const e = useSyncExternalStore(sub, () => peek<Recent[]>(KEY), () => undefined);
  useEffect(() => {
    void hydrate(KEY);
  }, []);
  return e?.data ?? [];
}
