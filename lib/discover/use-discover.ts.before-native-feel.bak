"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { discoverApi, type DiscoverFilter, type DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { seedFollows } from "@/lib/feed/follow-store";

export interface DiscoverData {
  key: string;
  items: DiscoverItem[];
  cursor: string | null;
  hasMore: boolean;
  caughtUp: boolean;
  sessionId: string | null;
  loadingMore: boolean;
  error: string | null;
  notice: string | null;
  fromCache: boolean;
}

// Last grid per account+filter, kept in memory so coming back to Discover is instant (Flutter keeps 30 on disk).
const CACHE_ITEMS = 30;
const cache = new Map<string, DiscoverData>();

const seed = (items: DiscoverItem[]) => seedFollows(items.map((i) => i.post.author));
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

// setState only runs in promise callbacks / handlers. "loading" is derived from the key.
export function useDiscover({ enabled, userId, filter }: { enabled: boolean; userId: number; filter: DiscoverFilter }) {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [nonce, setNonce] = useState(0);
  const base = `${userId}:${filter}`;
  const key = `${base}:${nonce}`;

  const latest = useRef({ data, key, filter });
  useEffect(() => {
    latest.current = { data, key, filter };
  });
  const inflight = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    discoverApi
      .page({ filter, refresh: true, signal: ac.signal })
      .then((res) => {
        if (ac.signal.aborted) return;
        seed(res.items);
        const d: DiscoverData = {
          key,
          items: res.items,
          cursor: res.nextCursor,
          hasMore: res.hasMore,
          caughtUp: res.caughtUp,
          sessionId: res.sessionId,
          loadingMore: false,
          error: null,
          notice: null,
          fromCache: false,
        };
        if (res.items.length > 0) {
          cache.set(base, { ...d, items: res.items.slice(0, CACHE_ITEMS), cursor: null, hasMore: false });
        }
        setData(d);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setData((prev) =>
          prev && prev.key.startsWith(`${base}:`) && prev.items.length > 0
            ? { ...prev, key, loadingMore: false, notice: "Couldn't refresh. Showing your last grid." }
            : {
                key,
                items: [],
                cursor: null,
                hasMore: false,
                caughtUp: false,
                sessionId: null,
                loadingMore: false,
                error: messageOf(e),
                notice: null,
                fromCache: false,
              },
        );
      });
    return () => ac.abort();
  }, [enabled, filter, nonce, key, base]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const maybeLoadMore = useCallback(() => {
    const { data: d, key: k, filter: f } = latest.current;
    if (!d || d.key !== k || !d.cursor || !d.hasMore || d.loadingMore || inflight.current) return;
    inflight.current = true;
    const dKey = d.key;
    setData((prev) => (prev && prev.key === dKey ? { ...prev, loadingMore: true } : prev));
    discoverApi
      .page({ filter: f, cursor: d.cursor })
      .then((res) => {
        seed(res.items);
        setData((prev) => {
          if (!prev || prev.key !== dKey) return prev;
          const ids = new Set(prev.items.map((i) => i.id));
          return {
            ...prev,
            items: [...prev.items, ...res.items.filter((i) => !ids.has(i.id))],
            cursor: res.nextCursor,
            hasMore: res.hasMore,
            caughtUp: res.caughtUp,
            loadingMore: false,
          };
        });
      })
      .catch(() => setData((prev) => (prev && prev.key === dKey ? { ...prev, loadingMore: false } : prev)))
      .finally(() => {
        inflight.current = false;
      });
  }, []);

  const patchPost = useCallback((id: number, patch: Partial<Post>) => {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.post.id === id ? { ...i, post: { ...i.post, ...patch } } : i)) } : prev,
    );
  }, []);

  const removePost = useCallback((id: number) => {
    setData((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.post.id !== id) } : prev));
  }, []);

  const live = data?.key === key ? data : null;
  const cached = cache.get(base) ?? null;
  const view = useMemo<DiscoverData | null>(() => {
    if (live && !(live.error && cached)) return live;
    if (cached) {
      return { ...cached, key, fromCache: true, notice: live?.error ? "Couldn't refresh. Showing your last grid." : null };
    }
    return live;
  }, [live, cached, key]);

  const loading = enabled && live === null;
  return { view, loading, reload, maybeLoadMore, patchPost, removePost };
}
