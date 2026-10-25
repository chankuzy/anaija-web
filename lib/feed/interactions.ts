"use client";

import { useSyncExternalStore } from "react";
import type { Post } from "@/lib/api/feed-types";
import { peek, put, subscribeKey } from "@/lib/cache/swr";

// What this viewer did to each post (like / bookmark / repost). It overrides stale cached copies of a post
// (feed on disk, discover, profile grids) until a fresh server copy fetched after the action replaces it.
export type Ix = {
  is_liked?: boolean;
  likes_count?: number;
  is_bookmarked?: boolean;
  bookmarks_count?: number;
  is_reposted?: boolean;
  reposts_count?: number;
  at: number;
};
type Store = Record<string, Ix>;

const KEY = "ix:v1";
const TTL = 7 * 24 * 60 * 60_000;
const EMPTY: Store = {};
const KEYS = ["is_liked", "likes_count", "is_bookmarked", "bookmarks_count", "is_reposted", "reposts_count"] as const;

const read = (): Store => peek<Store>(KEY)?.data ?? EMPTY;

export function pickIx(p: Partial<Post>): Partial<Omit<Ix, "at">> | null {
  const out: Record<string, unknown> = {};
  let any = false;
  for (const k of KEYS) {
    if (p[k] !== undefined) {
      out[k] = p[k];
      any = true;
    }
  }
  return any ? (out as Partial<Omit<Ix, "at">>) : null;
}

export function setIx(id: number, p: Partial<Omit<Ix, "at">>) {
  const now = Date.now();
  const next: Store = {};
  for (const [k, v] of Object.entries(read())) if (now - v.at < TTL) next[k] = v;
  next[id] = { ...next[id], ...p, at: now };
  put(KEY, next);
}

// A fresh server copy (request started at t0) already contains anything we did before t0.
export function reconcile(ids: number[], t0: number) {
  const cur = read();
  const next = { ...cur };
  let changed = false;
  for (const id of ids) {
    const v = next[id];
    if (v && v.at < t0) {
      delete next[id];
      changed = true;
    }
  }
  if (changed) put(KEY, next);
}

export function useIx(id: number): Ix | undefined {
  const all = useSyncExternalStore((cb) => subscribeKey(KEY, cb), read, () => EMPTY);
  return all[id];
}

export function withIx(post: Post, v?: Ix): Post {
  if (!v) return post;
  const { at: _at, ...rest } = v;
  void _at;
  return { ...post, ...rest };
}
