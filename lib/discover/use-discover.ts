"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { discoverApi, type DiscoverFilter, type DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { hydrate, isBusy, onCacheClear, peek, put, revalidate, subscribeKey, useCacheEpoch } from "@/lib/cache/swr";
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
  firstLen: number; // size of the first page; only that part is persisted for cold starts
}

const STALE_MS = 3 * 60_000;

// A fresh first page that arrived while the viewer was looking at the grid waits here and is swapped in when
// they leave Discover, so the next visit is fresh without anything ever shifting under their thumb.
const staged = new Map<string, DiscoverData>();
const confirmed = new Set<string>(); // keys fetched live during this session (vs. only restored from disk)
const moreBusy = new Set<string>();
onCacheClear(() => {
  staged.clear();
  confirmed.clear();
  moreBusy.clear();
});

const seed = (items: DiscoverItem[]) => seedFollows(items.map((i) => i.post.author));
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

function save(k: string, d: DiscoverData) {
  const first = !d.error && d.items.length > 0 && d.items.length <= d.firstLen;
  put(k, d, { persist: first, persistAs: first ? { ...d, loadingMore: false, notice: null } : undefined });
}

function applyStaged(k: string) {
  const s = staged.get(k);
  if (!s) return;
  staged.delete(k);
  save(k, s);
}

function loadFirst(k: string, filter: DiscoverFilter, replace: boolean): Promise<void> {
  return revalidate<DiscoverData>(
    k,
    async () => {
      const res = await discoverApi.page({ filter, refresh: true });
      seed(res.items);
      return {
        key: k,
        items: res.items,
        cursor: res.nextCursor,
        hasMore: res.hasMore,
        caughtUp: res.caughtUp,
        sessionId: res.sessionId,
        loadingMore: false,
        error: null,
        notice: null,
        fromCache: false,
        firstLen: res.items.length,
      };
    },
    {
      merge: (old, next) => {
        if (!replace && old && !old.error && old.items.length > 0) {
          staged.set(k, next);
          return old;
        }
        return next;
      },
      persist: (v) => !v.error && v.items.length > 0 && v.items.length <= v.firstLen,
    },
  )
    .then(() => {
      confirmed.add(k);
    })
    .catch((e: unknown) => {
      const cur = peek<DiscoverData>(k)?.data;
      if (cur && !cur.error && cur.items.length > 0) {
        put(k, { ...cur, notice: "Couldn't refresh. Showing your last grid." }, { persist: false });
        window.setTimeout(() => {
          const c = peek<DiscoverData>(k)?.data;
          if (c?.notice) put(k, { ...c, notice: null }, { persist: false });
        }, 3500);
      } else {
        put<DiscoverData>(
          k,
          {
            key: k,
            items: [],
            cursor: null,
            hasMore: false,
            caughtUp: false,
            sessionId: null,
            loadingMore: false,
            error: messageOf(e),
            notice: null,
            fromCache: false,
            firstLen: 0,
          },
          { persist: false },
        );
      }
    });
}

export function useDiscover({ enabled, userId, filter }: { enabled: boolean; userId: number; filter: DiscoverFilter }) {
  const k = `discover:${userId}:${filter}`;
  const sub = useCallback((cb: () => void) => subscribeKey(k, cb), [k]);
  const entry = useSyncExternalStore(sub, () => peek<DiscoverData>(k), () => undefined);
  const busy = useSyncExternalStore(sub, () => isBusy(k), () => false);
  const epochNow = useCacheEpoch();
  const data = entry?.data ?? null;

  // Paint the cached grid instantly; fetch only if there is nothing, it errored, or it has gone stale.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void hydrate(k).then(() => {
      if (!alive) return;
      const e = peek<DiscoverData>(k);
      if (!e || e.data.error) {
        void loadFirst(k, filter, true);
        return;
      }
      if (Date.now() - e.at > STALE_MS) {
        // Only restored from disk (never seen live): that grid is just a placeholder, replace it.
        // Already live this session: stage the fresh page for the next visit instead of shifting the grid.
        void loadFirst(k, filter, !confirmed.has(k));
      }
    });
    return () => {
      alive = false;
      applyStaged(k);
    };
  }, [enabled, k, filter, epochNow]);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const e = peek<DiscoverData>(k);
      if (e && !e.data.error && Date.now() - e.at > STALE_MS) void loadFirst(k, filter, !confirmed.has(k));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, k, filter]);

  const reload = useCallback(() => {
    void loadFirst(k, filter, true).then(() => applyStaged(k));
  }, [k, filter]);

  const maybeLoadMore = useCallback(() => {
    const d = peek<DiscoverData>(k)?.data;
    if (!d || !d.cursor || !d.hasMore || d.loadingMore || moreBusy.has(k)) return;
    moreBusy.add(k);
    save(k, { ...d, loadingMore: true });
    discoverApi
      .page({ filter, cursor: d.cursor })
      .then((res) => {
        seed(res.items);
        const cur = peek<DiscoverData>(k)?.data ?? d;
        const ids = new Set(cur.items.map((i) => i.id));
        save(k, {
          ...cur,
          items: [...cur.items, ...res.items.filter((i) => !ids.has(i.id))],
          cursor: res.nextCursor,
          hasMore: res.hasMore,
          caughtUp: res.caughtUp,
          loadingMore: false,
        });
      })
      .catch(() => save(k, { ...(peek<DiscoverData>(k)?.data ?? d), loadingMore: false }))
      .finally(() => {
        moreBusy.delete(k);
      });
  }, [k, filter]);

  const patchPost = useCallback(
    (id: number, patch: Partial<Post>) => {
      const d = peek<DiscoverData>(k)?.data;
      if (!d) return;
      save(k, { ...d, items: d.items.map((i) => (i.post.id === id ? { ...i, post: { ...i.post, ...patch } } : i)) });
    },
    [k],
  );

  const removePost = useCallback(
    (id: number) => {
      const d = peek<DiscoverData>(k)?.data;
      if (!d) return;
      const items = d.items.filter((i) => i.post.id !== id);
      save(k, { ...d, items, firstLen: Math.min(d.firstLen, items.length) });
    },
    [k],
  );

  const view = useMemo<DiscoverData | null>(
    () => (data ? { ...data, fromCache: !confirmed.has(k) } : null),
    // busy flips when a revalidation settles, which is exactly when `confirmed` can change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, k, busy],
  );

  const loading = enabled && data === null;
  const refreshing = busy && data !== null;
  return { view, loading, refreshing, reload, maybeLoadMore, patchPost, removePost };
}
