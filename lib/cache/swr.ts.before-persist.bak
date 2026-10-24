"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api/client";
import { kvClear, kvGet, kvSet } from "./kv";

// Stale-while-revalidate cache: memory first, IndexedDB behind it. Cached data renders instantly, a silent
// background fetch reconciles it, and subscribers only re-render when the data actually changed.

export interface Entry<T> {
  data: T;
  at: number;
}

const mem = new Map<string, Entry<unknown>>();
const subs = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<unknown>>();
const hydrating = new Map<string, Promise<void>>();
const errors = new Map<string, string>();
const clearHooks = new Set<() => void>();
let epoch = 0;

export const cacheEpoch = () => epoch;
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const sameJson = (a: unknown, b: unknown) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

function emit(key: string) {
  subs.get(key)?.forEach((l) => l());
}

export function subscribeKey(key: string | null, cb: () => void) {
  if (!key) return () => {};
  const bucket = subs.get(key) ?? new Set<() => void>();
  subs.set(key, bucket);
  bucket.add(cb);
  return () => {
    bucket.delete(cb);
  };
}

export const peek = <T>(key: string | null): Entry<T> | undefined =>
  key ? (mem.get(key) as Entry<T> | undefined) : undefined;
export const isBusy = (key: string | null) => (key ? inflight.has(key) : false);
export const errorOf = (key: string | null) => (key ? (errors.get(key) ?? null) : null);

export function put<T>(key: string, data: T, opts: { persist?: boolean; persistAs?: unknown } = {}) {
  const entry: Entry<T> = { data, at: Date.now() };
  mem.set(key, entry);
  emit(key);
  if (opts.persist !== false) void kvSet(key, { data: opts.persistAs ?? data, at: entry.at });
}

/** Loads a persisted entry into memory (no-op if already there). Resolves either way. */
export function hydrate(key: string): Promise<void> {
  if (mem.has(key)) return Promise.resolve();
  const running = hydrating.get(key);
  if (running) return running;
  const e = epoch;
  const p = kvGet<Entry<unknown>>(key)
    .then((v) => {
      if (v && e === epoch && !mem.has(key)) {
        mem.set(key, v);
        emit(key);
      }
    })
    .finally(() => {
      hydrating.delete(key);
    });
  hydrating.set(key, p);
  return p;
}

/** One fetch per key at a time. `merge` reconciles with what is cached; identical results cause no re-render. */
export function revalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { merge?: (old: T | undefined, next: T) => T; persist?: boolean | ((v: T) => boolean) } = {},
): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const e = epoch;
  const p = fetcher()
    .then((next) => {
      if (e !== epoch) return next;
      errors.delete(key);
      const old = peek<T>(key)?.data;
      const merged = opts.merge ? opts.merge(old, next) : next;
      if (old !== undefined && sameJson(old, merged)) {
        const cur = mem.get(key);
        if (cur) cur.at = Date.now();
      } else {
        const persist = typeof opts.persist === "function" ? opts.persist(merged) : opts.persist;
        put(key, merged, { persist });
      }
      return merged;
    })
    .catch((err: unknown) => {
      if (e === epoch) errors.set(key, messageOf(err));
      throw err;
    })
    .finally(() => {
      inflight.delete(key);
      emit(key);
    });
  inflight.set(key, p);
  emit(key);
  return p;
}

export function onCacheClear(fn: () => void) {
  clearHooks.add(fn);
  return () => {
    clearHooks.delete(fn);
  };
}

/** Sign-out / account switch: nothing from the previous account may survive. */
export async function clearCache() {
  epoch++;
  const keys = [...mem.keys()];
  mem.clear();
  errors.clear();
  inflight.clear();
  keys.forEach(emit);
  clearHooks.forEach((h) => h());
  await kvClear();
}

export const useCacheEpoch = () => useSyncExternalStore(onCacheClear, cacheEpoch, () => 0);

export function useCached<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: {
    staleMs?: number;
    enabled?: boolean;
    merge?: (old: T | undefined, next: T) => T;
    persist?: boolean | ((v: T) => boolean);
  } = {},
) {
  const { staleMs = 60_000, enabled = true, persist } = opts;
  const sub = useCallback((cb: () => void) => subscribeKey(key, cb), [key]);
  const entry = useSyncExternalStore(sub, () => peek<T>(key), () => undefined);
  const busy = useSyncExternalStore(sub, () => isBusy(key), () => false);
  const error = useSyncExternalStore(sub, () => errorOf(key), () => null);
  const epochNow = useCacheEpoch();

  const fetchRef = useRef(fetcher);
  const mergeRef = useRef(opts.merge);
  useEffect(() => {
    fetchRef.current = fetcher;
    mergeRef.current = opts.merge;
  });

  const run = useCallback(
    () =>
      key
        ? revalidate<T>(key, () => fetchRef.current(), { merge: mergeRef.current, persist }).catch(() => undefined)
        : Promise.resolve(undefined),
    [key, persist],
  );

  useEffect(() => {
    if (!key || !enabled) return;
    let alive = true;
    void hydrate(key).then(() => {
      if (!alive) return;
      const e = peek<T>(key);
      if (e && Date.now() - e.at < staleMs) return;
      void run();
    });
    return () => {
      alive = false;
    };
  }, [key, enabled, staleMs, run, epochNow]);

  // Coming back to the tab reconciles quietly if the data has gone stale.
  useEffect(() => {
    if (!key || !enabled) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const e = peek<T>(key);
      if (!e || Date.now() - e.at >= staleMs) void run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [key, enabled, staleMs, run]);

  const mutate = useCallback(
    (fn: (old: T) => T) => {
      if (!key) return;
      const cur = peek<T>(key);
      if (cur) put(key, fn(cur.data), { persist: typeof persist === "function" ? persist(cur.data) : persist });
    },
    [key, persist],
  );

  return {
    data: entry?.data,
    loading: !!key && enabled && !entry && !error,
    refreshing: busy && !!entry,
    error: entry ? null : error,
    refresh: run,
    mutate,
  };
}
