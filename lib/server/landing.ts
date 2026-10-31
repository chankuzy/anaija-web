import { cacheLife, cacheTag } from "next/cache";
import { callFunction } from "@/lib/server/upstream";
import { mediaUrl, normPost } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";
import { coverOf } from "@/lib/discover/tile";

// Public data for the guest landing page. Everything here is read with NO token, so it can only ever contain
// what a signed-out visitor is already allowed to see. Each item is reduced to a small DTO (never a raw upstream
// object), and anything unexpected is dropped rather than shown.

export interface LandingCommunity {
  slug: string;
  name: string;
  avatar: string | null;
  cover: string | null;
  category: string | null;
  members: number;
  description: string | null;
}
export interface LandingTile {
  id: number;
  href: string;
  kind: "post" | "reel" | "listing";
  image: string;
  color: string | null;
  title: string;
  byline: string | null;
  price: string | null;
}
export interface LandingData {
  communities: LandingCommunity[];
  tiles: LandingTile[];
}

const https = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  const u = mediaUrl(v);
  return typeof u === "string" && /^https:\/\//i.test(u) ? u : null;
};
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

// Listed communities only. A description is shown only when the community previews publicly (same rule as its share card).
async function fetchCommunities(): Promise<LandingCommunity[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("landing:communities");
  const res = await callFunction("communities/discover", { query: "page=1" });
  if (res.status >= 400 && res.status < 500) return []; // e.g. discover is sign-in only: show nothing, cache that.
  if (!res.ok) throw new Error(`communities/discover ${res.status}`);
  const rows = rec(await res.json())?.data;
  const out: LandingCommunity[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const c = rec(r);
    if (!c || c.discoverability !== "listed") continue;
    if (typeof c.slug !== "string" || typeof c.name !== "string" || !/^[a-z0-9][a-z0-9-]{0,60}$/i.test(c.slug)) continue;
    out.push({
      slug: c.slug,
      name: clip(c.name, 60),
      avatar: https(c.avatar),
      cover: https(c.cover),
      category: typeof c.category === "string" && c.category ? c.category.replace(/_/g, " ") : null,
      members: typeof c.members_count === "number" ? c.members_count : 0,
      description: c.read_policy === "public_preview" && typeof c.description === "string" && c.description ? clip(c.description, 110) : null,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function toTile(raw: unknown): LandingTile | null {
  const outer = rec(raw);
  if (!outer) return null;
  const inner = rec(outer.data) ?? outer;
  if (rec(outer.data) && outer.type !== "post" && outer.type !== "listing") return null;
  if (typeof inner.id !== "number") return null;
  // Never surface anything scoped to a community on the public landing page.
  if (inner.community_id || inner.community) return null;
  let post: Post;
  try {
    post = normPost(inner as unknown as Post);
  } catch {
    return null;
  }
  const cover = coverOf(post);
  const image = https(cover.url);
  if (!image) return null;
  const d = post.listing;
  const isListing = post.type === "listing" || !!d;
  const caption = (post.caption ?? "").trim();
  const title = clip((isListing ? d?.business_name?.trim() : "") || caption || (isListing ? "Listing on Anaija" : "Post on Anaija"), 90);
  const price = isListing && d?.formatted_price ? `${!d.currency || d.currency === "NGN" ? "₦" : `${d.currency} `}${d.formatted_price}` : null;
  return {
    id: post.id,
    href: isListing ? `/l/${post.id}` : `/p/${post.id}`,
    kind: isListing ? "listing" : cover.isVideo ? "reel" : "post",
    image,
    color: cover.color,
    title,
    byline: post.author?.username ? `@${post.author.username}` : null,
    price,
  };
}

// The same guest feed the old home page used. Tolerant of the response being { items | posts | data } or a bare array.
async function fetchTiles(): Promise<LandingTile[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("landing:tiles");
  const res = await callFunction("feed-public");
  if (res.status >= 400 && res.status < 500) return [];
  if (!res.ok) throw new Error(`feed-public ${res.status}`);
  const j: unknown = await res.json();
  const root = rec(j);
  const list = Array.isArray(j) ? j : ([root?.items, root?.posts, root?.data].find(Array.isArray) as unknown[] | undefined) ?? [];
  const seen = new Set<number>();
  const out: LandingTile[] = [];
  for (const r of list) {
    const t = toTile(r);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= 16) break;
  }
  return out;
}

const safe = async <T,>(fn: () => Promise<T[]>): Promise<T[]> => {
  try {
    return await fn();
  } catch {
    return [];
  }
};
const within = <T,>(p: Promise<T[]>, ms: number): Promise<T[]> =>
  Promise.race([p, new Promise<T[]>((r) => setTimeout(() => r([]), ms))]);

/** Never throws and never waits long: a slow or failing upstream just means an empty section. */
export async function getLandingData(): Promise<LandingData> {
  const [communities, tiles] = await Promise.all([within(safe(fetchCommunities), 3000), within(safe(fetchTiles), 3000)]);
  return { communities, tiles };
}
