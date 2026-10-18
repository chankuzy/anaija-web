"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";

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
}

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

function dedupe<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

// Cached-per-mount paged list. setState only runs in promise callbacks / handlers. A reload keeps the old items
// on screen (stale-while-revalidate); "loading" is derived from the key.
export function usePaged<T extends { id: number }, C>({
  id,
  enabled,
  load,
}: {
  id: string;
  enabled: boolean;
  load: (cursor: C | null, signal?: AbortSignal) => Promise<Page<T, C>>;
}) {
  const [data, setData] = useState<PagedData<T, C> | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${id}:${nonce}`;

  const loadRef = useRef(load);
  const latest = useRef({ data, key });
  const inflight = useRef(false);
  useEffect(() => {
    loadRef.current = load;
    latest.current = { data, key };
  });

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    loadRef
      .current(null, ac.signal)
      .then((p) => {
        if (ac.signal.aborted) return;
        setData({ key, items: dedupe(p.items), cursor: p.cursor, hasMore: p.hasMore, loadingMore: false, moreError: false, error: null });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setData((prev) =>
          prev && prev.items.length > 0
            ? { ...prev, key }
            : { key, items: [], cursor: null, hasMore: false, loadingMore: false, moreError: false, error: messageOf(e) },
        );
      });
    return () => ac.abort();
  }, [enabled, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const loadMore = useCallback((force = false) => {
    const { data: d, key: k } = latest.current;
    if (!d || d.key !== k || !d.hasMore || d.cursor === null || d.loadingMore || inflight.current) return;
    if (d.moreError && !force) return;
    inflight.current = true;
    const dKey = d.key;
    setData((prev) => (prev && prev.key === dKey ? { ...prev, loadingMore: true, moreError: false } : prev));
    loadRef
      .current(d.cursor)
      .then((p) => {
        setData((prev) => {
          if (!prev || prev.key !== dKey) return prev;
          const ids = new Set(prev.items.map((i) => i.id));
          return {
            ...prev,
            items: [...prev.items, ...p.items.filter((i) => !ids.has(i.id))],
            cursor: p.cursor,
            hasMore: p.hasMore,
            loadingMore: false,
          };
        });
      })
      .catch(() => setData((prev) => (prev && prev.key === dKey ? { ...prev, loadingMore: false, moreError: true } : prev)))
      .finally(() => {
        inflight.current = false;
      });
  }, []);

  const patch = useCallback((itemId: number, partial: Partial<T>) => {
    setData((prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, ...partial } : i)) } : prev));
  }, []);

  const remove = useCallback((itemId: number) => {
    setData((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev));
  }, []);

  const loading = enabled && (data === null || data.key !== key);
  return { data, loading, reload, loadMore, patch, remove };
}
