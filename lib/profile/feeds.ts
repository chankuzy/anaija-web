import { normPost } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";
import { usersApi } from "@/lib/api/users";
import { seedFollows } from "@/lib/feed/follow-store";
import type { Page } from "@/lib/paged/use-paged";

// ── Posts tab: /users-posts + /users-listings are two id-descending cursor streams (port of _PostsPager) ──
export interface PostsCursor {
  p: string | null;
  l: string | null;
  pm: boolean;
  lm: boolean;
}

export async function loadPosts(username: string, cursor: PostsCursor | null, signal?: AbortSignal): Promise<Page<Post, PostsCursor>> {
  const c = cursor ?? { p: null, l: null, pm: true, lm: true };
  // Both are awaited before any cursor moves, so one failing stream never skips the other's items.
  const [pr, lr] = await Promise.all([
    c.pm ? usersApi.posts(username, c.p, signal) : Promise.resolve(null),
    c.lm ? usersApi.listings(username, c.l, signal) : Promise.resolve(null),
  ]);
  const next: PostsCursor = { ...c };
  const items: Post[] = [];
  if (pr) {
    next.p = pr.next_cursor ?? null;
    next.pm = pr.has_more === true;
    items.push(...(pr.data ?? []).map(normPost));
  }
  if (lr) {
    next.l = lr.next_cursor ?? null;
    next.lm = lr.has_more === true;
    items.push(...(lr.data ?? []).map(normPost));
  }
  return { items, cursor: next, hasMore: next.pm || next.lm };
}

// Only display down to the "horizon" (highest of the streams' lowest loaded ids, among streams with more) so a
// page always appends at the bottom. Pinned items always show, first.
export function postsView(raw: Post[], c: PostsCursor | null): Post[] {
  const lowest = (listing: boolean) => {
    let m: number | null = null;
    for (const p of raw) if ((p.type === "listing") === listing && (m === null || p.id < m)) m = p.id;
    return m;
  };
  let horizon: number | null = null;
  if (c?.pm) horizon = lowest(false);
  if (c?.lm) {
    const l = lowest(true);
    if (l !== null && (horizon === null || l > horizon)) horizon = l;
  }
  const h = horizon;
  return raw
    .filter((p) => p.pinned_at !== null || h === null || p.id >= h)
    .sort((a, b) => {
      const ap = a.pinned_at !== null;
      const bp = b.pinned_at !== null;
      if (ap !== bp) return ap ? -1 : 1;
      return b.id - a.id;
    });
}

const IMAGE_TYPES = new Set(["image", "photo", "picture"]);
// Port of Listing.isReel: the cover is a video (no images, at least one video).
export function isReel(p: Post): boolean {
  const media = p.media ?? [];
  if (media.length === 0) return false;
  const hasImage = media.some((m) => IMAGE_TYPES.has((m.type ?? "").toLowerCase()));
  return !hasImage && media.some((m) => (m.type ?? "").toLowerCase() === "video");
}

export async function loadReposts(username: string, cursor: number | null, signal?: AbortSignal): Promise<Page<Post, number>> {
  const page = cursor ?? 1;
  const r = await usersApi.reposts(username, page, signal);
  const items = (r.data ?? []).map(normPost);
  seedFollows(items.map((p) => p.author));
  return { items, cursor: r.has_more ? page + 1 : null, hasMore: r.has_more === true };
}

export async function loadLiked(cursor: string | null, signal?: AbortSignal): Promise<Page<Post, string>> {
  const r = await usersApi.liked(cursor, signal);
  const items = (r.data ?? []).map(normPost);
  seedFollows(items.map((p) => p.author));
  return { items, cursor: r.next_cursor ?? null, hasMore: r.has_more === true };
}

// The server drops inactive posts after paging, so a page can come back empty with more still to come.
export async function loadSaved(cursor: number | null, signal?: AbortSignal): Promise<Page<Post, number>> {
  let page = cursor ?? 1;
  for (let i = 0; i < 3; i++) {
    const r = await usersApi.saved(page, signal);
    const items = (r.data ?? []).flatMap((b) => (b.post ? [normPost(b.post)] : []));
    if (items.length > 0 || r.has_more !== true) {
      return { items, cursor: r.has_more ? page + 1 : null, hasMore: r.has_more === true };
    }
    page += 1;
  }
  return { items: [], cursor: page, hasMore: true };
}
