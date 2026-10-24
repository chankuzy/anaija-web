"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { feedApi } from "@/lib/api/feed";
import type { FeedItem, FeedScope, Post } from "@/lib/api/feed-types";
import { seedFollows } from "./follow-store";

export interface FeedData {
  key: string;
  sessionId: string | null;
  items: FeedItem[];
  cursor: string | null;
  caughtUp: boolean;
  nextActions: string[];
  loadingMore: boolean;
  error: string | null;
  notice: string | null;
}

const itemKey = (i: FeedItem) => (i.type === "post" ? `p${i.post.id}` : `u${i.id}`);

function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = itemKey(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const seed = (items: FeedItem[]) => seedFollows(items.flatMap((i) => (i.type === "post" ? [i.post.author] : [])));
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

// setState is only ever called from promise callbacks / event handlers, never synchronously in an effect.
// "loading" is derived: data.key !== the key the current inputs would produce.
export function useFeed({ enabled, authed, scope }: { enabled: boolean; authed: boolean; scope: FeedScope }) {
  const [data, setData] = useState<FeedData | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${authed ? "auth" : "guest"}:${scope}:${nonce}`;

  const latest = useRef({ data, key, authed, scope });
  useEffect(() => {
    latest.current = { data, key, authed, scope };
  });
  const inflight = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    feedApi
      .page({ authed, scope, refresh: nonce > 0, signal: ac.signal })
      .then((res) => {
        if (ac.signal.aborted) return;
        seed(res.items);
        setData({
          key,
          sessionId: res.session_id ?? null,
          items: dedupe(res.items),
          cursor: res.next_cursor,
          caughtUp: res.caught_up,
          nextActions: res.next_actions ?? [],
          loadingMore: false,
          error: null,
          notice: null,
        });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setData((prev) =>
          prev && prev.items.length > 0
            ? { ...prev, key, loadingMore: false, error: null, notice: "Couldn't refresh. Showing your last feed." }
            : {
                key,
                sessionId: null,
                items: [],
                cursor: null,
                caughtUp: false,
                nextActions: [],
                loadingMore: false,
                error: messageOf(e),
                notice: null,
              },
        );
      });
    return () => ac.abort();
  }, [enabled, authed, scope, nonce, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // `index` is the position among rendered entries (posts and people units). Loads when within the
  // last third (same rule as Flutter).
  const maybeLoadMore = useCallback((index: number) => {
    const { data: d, key: k, authed: a, scope: s } = latest.current;
    if (!d || d.key !== k || !d.cursor || d.loadingMore || inflight.current) return;
    const total = d.items.length;
    if (total === 0 || index < total - Math.ceil(total / 3)) return;

    inflight.current = true;
    const dKey = d.key;
    setData((prev) => (prev && prev.key === dKey ? { ...prev, loadingMore: true } : prev));
    feedApi
      .page({ authed: a, scope: s, cursor: d.cursor })
      .then((res) => {
        seed(res.items);
        setData((prev) => {
          if (!prev || prev.key !== dKey) return prev;
          const seen = new Set(prev.items.map(itemKey));
          const add = res.items.filter((i) => !seen.has(itemKey(i)));
          return {
            ...prev,
            items: [...prev.items, ...add],
            cursor: res.next_cursor,
            caughtUp: res.caught_up,
            nextActions: res.next_actions ?? prev.nextActions,
            loadingMore: false,
          };
        });
      })
      .catch(() => {
        setData((prev) => (prev && prev.key === dKey ? { ...prev, loadingMore: false } : prev));
      })
      .finally(() => {
        inflight.current = false;
      });
  }, []);

  const patchPost = useCallback((id: number, patch: Partial<Post>) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.type === "post" && it.post.id === id ? { ...it, post: { ...it.post, ...patch } } : it,
            ),
          }
        : prev,
    );
  }, []);

  const removePost = useCallback((id: number) => {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.filter((it) => !(it.type === "post" && it.post.id === id)) } : prev,
    );
  }, []);

  const loading = enabled && (data === null || data.key !== key);
  return { data, loading, reload, maybeLoadMore, patchPost, removePost };
}
