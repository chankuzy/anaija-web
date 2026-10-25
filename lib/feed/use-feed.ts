"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { feedApi } from "@/lib/api/feed";
import type { FeedItem, FeedScope, Post } from "@/lib/api/feed-types";
import { cacheEpoch, onCacheClear, peek, put, useCacheEpoch } from "@/lib/cache/swr";
import { kvGet } from "@/lib/cache/kv";
import { resetFollows, seedFollows } from "./follow-store";
import { reconcile } from "./interactions";

export interface FeedData {
  sessionId: string | null;
  items: FeedItem[];
  cursor: string | null;
  caughtUp: boolean;
  nextActions: string[];
  loadingMore: boolean;
  error: string | null;
  notice: string | null;
}

// One slot per "auth:scope". Lives at module level, so it survives navigating away from the feed.
interface FeedSlot {
  data: FeedData | null;
  at: number; // when the first page was last fetched
  fresh: FeedData | null; // a newer first page waiting behind the "New posts" pill
  loading: boolean; // manual refresh / first load in flight
  gen: number; // bumps whenever the list is replaced (not on load-more)
}

const EMPTY: FeedSlot = { data: null, at: 0, fresh: null, loading: false, gen: 0 };
const STALE_MS = 5 * 60_000; // beyond this, returning to the feed reconciles in the background
const DISK_MAX_AGE_MS = 7 * 24 * 60 * 60_000; // a cold start shows the last feed, however long the app was closed

type Res = Awaited<ReturnType<typeof feedApi.page>>;

const slots = new Map<string, FeedSlot>();
const positions = new Map<string, number>();
const listeners = new Set<() => void>();
const inflightFirst = new Set<string>();
const moreInflight = new Set<string>();
const hydrating = new Map<string, Promise<void>>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
// A first page restored by the boot warm-up is adopted synchronously, so the very first render already shows
// the last feed instead of a skeleton frame.
function seedFromWarm(k: string): FeedSlot | null {
  const v = peek<FeedData>(`feed:${k}`);
  if (!v || Date.now() - v.at > DISK_MAX_AGE_MS || v.data.items.length === 0) return null;
  const s: FeedSlot = {
    data: { ...v.data, loadingMore: false, error: null, notice: null },
    at: v.at,
    fresh: null,
    loading: false,
    gen: 1,
  };
  slots.set(k, s);
  return s;
}
const slotOf = (k: string): FeedSlot => slots.get(k) ?? seedFromWarm(k) ?? EMPTY;
function setSlot(k: string, patch: Partial<FeedSlot>) {
  slots.set(k, { ...slotOf(k), ...patch });
  emit();
}
function patchData(k: string, fn: (d: FeedData) => FeedData) {
  const s = slots.get(k);
  if (!s?.data) return;
  slots.set(k, { ...s, data: fn(s.data) });
  emit();
}

onCacheClear(() => {
  slots.clear();
  positions.clear();
  resetFollows();
  emit();
});

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
const confirm = (items: FeedItem[], t0: number) => reconcile(items.flatMap((i) => (i.type === "post" ? [i.post.id] : [])), t0);
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

const toData = (res: Res): FeedData => ({
  sessionId: res.session_id ?? null,
  items: dedupe(res.items),
  cursor: res.next_cursor,
  caughtUp: res.caught_up,
  nextActions: res.next_actions ?? [],
  loadingMore: false,
  error: null,
  notice: null,
});

const errorData = (message: string): FeedData => ({
  sessionId: null,
  items: [],
  cursor: null,
  caughtUp: false,
  nextActions: [],
  loadingMore: false,
  error: message,
  notice: null,
});

function sameHead(cur: FeedItem[], next: FeedItem[]) {
  if (cur.length < next.length) return false;
  return next.every((it, i) => itemKey(it) === itemKey(cur[i]));
}

function hydrateSlot(k: string): Promise<void> {
  if (slots.get(k)?.data) return Promise.resolve();
  const running = hydrating.get(k);
  if (running) return running;
  const e = cacheEpoch();
  const p = kvGet<{ data: FeedData; at: number }>(`feed:${k}`)
    .then((v) => {
      if (!v || e !== cacheEpoch() || slots.get(k)?.data) return;
      if (Date.now() - v.at > DISK_MAX_AGE_MS || v.data.items.length === 0) return;
      setSlot(k, { data: { ...v.data, loadingMore: false, error: null, notice: null }, at: v.at, gen: 1 });
    })
    .finally(() => {
      hydrating.delete(k);
    });
  hydrating.set(k, p);
  return p;
}

type Mode = "initial" | "background" | "manual";

async function fetchFirst(k: string, authed: boolean, scope: FeedScope, mode: Mode) {
  if (mode !== "manual" && inflightFirst.has(k)) return;
  inflightFirst.add(k);
  const epoch = cacheEpoch();
  if (mode !== "background") setSlot(k, { loading: true });
  try {
    const t0 = Date.now();
    const res = await feedApi.page({ authed, scope, refresh: mode === "manual" });
    if (epoch !== cacheEpoch()) return;
    seed(res.items);
    confirm(res.items, t0);
    const next = toData(res);
    const cur = slotOf(k);
    if (mode === "background" && cur.data && !cur.data.error) {
      // Never swap the list under the viewer: same head -> nothing to do, otherwise offer it behind a pill.
      setSlot(k, sameHead(cur.data.items, next.items) ? { at: Date.now() } : { fresh: next, at: Date.now() });
    } else {
      positions.set(k, 0);
      setSlot(k, { data: next, at: Date.now(), fresh: null, loading: false, gen: cur.gen + 1 });
    }
    put(`feed:${k}`, next);
  } catch (e) {
    const cur = slotOf(k);
    if (cur.data && cur.data.items.length > 0 && !cur.data.error) {
      setSlot(k, {
        loading: false,
        data: mode === "background" ? cur.data : { ...cur.data, notice: "Couldn't refresh. Showing your last feed." },
      });
      if (mode !== "background") {
        window.setTimeout(() => patchData(k, (d) => (d.notice ? { ...d, notice: null } : d)), 3500);
      }
    } else {
      setSlot(k, { data: errorData(messageOf(e)), loading: false, gen: cur.gen + 1 });
    }
  } finally {
    inflightFirst.delete(k);
  }
}

function loadMoreFor(k: string, authed: boolean, scope: FeedScope, index: number) {
  const d = slotOf(k).data;
  if (!d || !d.cursor || d.loadingMore || moreInflight.has(k)) return;
  const total = d.items.length;
  if (total === 0 || index < total - Math.ceil(total / 3)) return; // last third, same rule as Flutter
  moreInflight.add(k);
  const t0 = Date.now();
  patchData(k, (x) => ({ ...x, loadingMore: true }));
  feedApi
    .page({ authed, scope, cursor: d.cursor })
    .then((res) => {
      seed(res.items);
      confirm(res.items, t0);
      patchData(k, (prev) => {
        const seen = new Set(prev.items.map(itemKey));
        return {
          ...prev,
          items: [...prev.items, ...res.items.filter((i) => !seen.has(itemKey(i)))],
          cursor: res.next_cursor,
          caughtUp: res.caught_up,
          nextActions: res.next_actions ?? prev.nextActions,
          loadingMore: false,
        };
      });
    })
    .catch(() => patchData(k, (x) => ({ ...x, loadingMore: false })))
    .finally(() => {
      moreInflight.delete(k);
    });
}

export function useFeed({ enabled, authed, scope }: { enabled: boolean; authed: boolean; scope: FeedScope }) {
  const k = `${authed ? "auth" : "guest"}:${scope}`;
  const slot = useSyncExternalStore(subscribe, () => slotOf(k), () => EMPTY);
  const epochNow = useCacheEpoch();

  // Show what we have instantly; fetch only if there's nothing, it errored, or it's stale.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void hydrateSlot(k).then(() => {
      if (!alive) return;
      const s = slotOf(k);
      if (!s.data || s.data.error) void fetchFirst(k, authed, scope, "initial");
      else if (Date.now() - s.at > STALE_MS) void fetchFirst(k, authed, scope, "background");
    });
    return () => {
      alive = false;
    };
  }, [enabled, k, authed, scope, epochNow]);

  // Coming back to the tab after a while: reconcile quietly.
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const s = slotOf(k);
      if (s.data && !s.data.error && Date.now() - s.at > STALE_MS) void fetchFirst(k, authed, scope, "background");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, k, authed, scope]);

  const reload = useCallback(() => void fetchFirst(k, authed, scope, "manual"), [k, authed, scope]);

  const applyFresh = useCallback(() => {
    const s = slotOf(k);
    if (!s.fresh) return;
    positions.set(k, 0);
    setSlot(k, { data: s.fresh, fresh: null, at: Date.now(), gen: s.gen + 1 });
  }, [k]);

  const maybeLoadMore = useCallback((index: number) => loadMoreFor(k, authed, scope, index), [k, authed, scope]);
  const getPosition = useCallback(() => positions.get(k) ?? 0, [k]);
  const setPosition = useCallback((i: number) => void positions.set(k, i), [k]);

  const patchPost = useCallback(
    (id: number, patch: Partial<Post>) =>
      patchData(k, (d) => ({
        ...d,
        items: d.items.map((it) =>
          it.type === "post" && it.post.id === id ? { ...it, post: { ...it.post, ...patch } } : it,
        ),
      })),
    [k],
  );

  const removePost = useCallback(
    (id: number) =>
      patchData(k, (d) => ({ ...d, items: d.items.filter((it) => !(it.type === "post" && it.post.id === id)) })),
    [k],
  );

  const loading = enabled && (slot.data === null || slot.loading);
  return {
    data: slot.data,
    hasFresh: slot.fresh !== null,
    gen: slot.gen,
    storeKey: k,
    loading,
    reload,
    applyFresh,
    maybeLoadMore,
    getPosition,
    setPosition,
    patchPost,
    removePost,
  };
}
