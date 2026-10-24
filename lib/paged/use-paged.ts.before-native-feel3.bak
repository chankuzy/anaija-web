"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { hydrate, isBusy, peek, put, revalidate, subscribeKey, useCacheEpoch } from "@/lib/cache/swr";

export interface Page<T, C> {
  items: T[];
  cursor: C | null;
  hasMore: boolean;
}
export interface PagedData<T, C> {
  key: string;
  items: T[];
  cursor: C | null;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: boolean;
  error: string | null;
  firstLen: number; // size of the first page; only that part is persisted for cold starts
}

const STALE_MS = 60_000;
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const moreBusy = new Set<string>();

function dedupe<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

// Fresh first page wins; anything the viewer already paged past stays where it was, so a background
// refresh never yanks the list.
function mergePaged<T extends { id: number }, C>(
  old: PagedData<T, C> | undefined,
  next: PagedData<T, C>,
): PagedData<T, C> {
  if (!old || old.error || old.items.length <= old.firstLen) return next;
  const nextIds = new Set(next.items.map((i) => i.id));
  const tail = old.items.slice(old.firstLen).filter((i) => !nextIds.has(i.id));
  return { ...old, items: [...next.items, ...tail], firstLen: next.items.length };
}

function save<T, C>(k: string, d: PagedData<T, C>) {
  const first = !d.error && d.items.length <= d.firstLen;
  put(k, d, { persist: first, persistAs: first ? { ...d, loadingMore: false, moreError: false } : undefined });
}

// Cached paged list: instant from memory/disk, silent revalidation when stale, no spinner on revisit.
export function usePaged<T extends { id: number }, C>({
  id,
  enabled,
  load,
}: {
  id: string;
  enabled: boolean;
  load: (cursor: C | null, signal?: AbortSignal) => Promise<Page<T, C>>;
}) {
  const k = `paged:${id}`;
  const sub = useCallback((cb: () => void) => subscribeKey(k, cb), [k]);
  const entry = useSyncExternalStore(sub, () => peek<PagedData<T, C>>(k), () => undefined);
  const busy = useSyncExternalStore(sub, () => isBusy(k), () => false);
  const epochNow = useCacheEpoch();
  const data = entry?.data ?? null;

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const fetchFirst = useCallback(async (): Promise<PagedData<T, C>> => {
    const p = await loadRef.current(null);
    const items = dedupe(p.items);
    return {
      key: id,
      items,
      cursor: p.cursor,
      hasMore: p.hasMore,
      loadingMore: false,
      moreError: false,
      error: null,
      firstLen: items.length,
    };
  }, [id]);

  const onFail = useCallback(
    (e: unknown) => {
      if (peek(k)) return;
      put<PagedData<T, C>>(
        k,
        { key: id, items: [], cursor: null, hasMore: false, loadingMore: false, moreError: false, error: messageOf(e), firstLen: 0 },
        { persist: false },
      );
    },
    [k, id],
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void hydrate(k).then(() => {
      if (!alive) return;
      const e = peek<PagedData<T, C>>(k);
      if (e && !e.data.error && Date.now() - e.at < STALE_MS) return;
      revalidate<PagedData<T, C>>(k, fetchFirst, {
        merge: mergePaged,
        persist: (v) => !v.error && v.items.length <= v.firstLen,
      }).catch(onFail);
    });
    return () => {
      alive = false;
    };
  }, [enabled, k, fetchFirst, onFail, epochNow]);

  // Explicit refresh (pull-to-refresh, "try again"): replace the list with the fresh first page.
  const reload = useCallback(() => {
    revalidate<PagedData<T, C>>(k, fetchFirst, { merge: (_old, next) => next }).catch(onFail);
  }, [k, fetchFirst, onFail]);

  const loadMore = useCallback(
    (force = false) => {
      const d = peek<PagedData<T, C>>(k)?.data;
      if (!d || !d.hasMore || d.cursor === null || d.loadingMore || moreBusy.has(k)) return;
      if (d.moreError && !force) return;
      moreBusy.add(k);
      save(k, { ...d, loadingMore: true, moreError: false });
      loadRef
        .current(d.cursor)
        .then((p) => {
          const cur = peek<PagedData<T, C>>(k)?.data ?? d;
          const ids = new Set(cur.items.map((i) => i.id));
          save(k, {
            ...cur,
            items: [...cur.items, ...p.items.filter((i) => !ids.has(i.id))],
            cursor: p.cursor,
            hasMore: p.hasMore,
            loadingMore: false,
          });
        })
        .catch(() => {
          const cur = peek<PagedData<T, C>>(k)?.data ?? d;
          save(k, { ...cur, loadingMore: false, moreError: true });
        })
        .finally(() => {
          moreBusy.delete(k);
        });
    },
    [k],
  );

  const patch = useCallback(
    (itemId: number, partial: Partial<T>) => {
      const d = peek<PagedData<T, C>>(k)?.data;
      if (d) save(k, { ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, ...partial } : i)) });
    },
    [k],
  );

  const remove = useCallback(
    (itemId: number) => {
      const d = peek<PagedData<T, C>>(k)?.data;
      if (!d) return;
      const items = d.items.filter((i) => i.id !== itemId);
      save(k, { ...d, items, firstLen: Math.min(d.firstLen, items.length) });
    },
    [k],
  );

  const loading = enabled && data === null;
  const refreshing = busy && data !== null;
  return { data, loading, refreshing, reload, loadMore, patch, remove };
}
