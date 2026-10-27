import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";

const typeOf = (t: string | null | undefined) => (t ?? "").toLowerCase();
const isVideoType = (t: string | null | undefined) => typeOf(t).includes("video");
const isDocType = (t: string | null | undefined) => typeOf(t) === "document";

// Visual cover of a post. Document files are never a picture: a document tile uses its cover thumbnail, if any.
export function coverOf(post: Post) {
  const sorted = [...(post.media ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const m = sorted.find((x) => !isDocType(x.type)) ?? null;
  const doc = sorted.find((x) => isDocType(x.type)) ?? null;
  const isVideo = m ? isVideoType(m.type) : !!post.video_url;
  const url = m ? (isVideo ? (m.thumbnail ?? post.thumbnail_url) : (m.url ?? m.thumbnail)) : (doc?.thumbnail ?? post.thumbnail_url);
  const c = m?.dominant_color?.trim() ?? "";
  const color = /^#?[0-9a-f]{6}$/i.test(c) ? (c.startsWith("#") ? c : `#${c}`) : null;
  return { url: url || null, isVideo, aspect: m?.aspect_ratio ?? null, color };
}

// Playable source for a video tile (null for image tiles).
export function videoSrcOf(post: Post): string | null {
  const v = (post.media ?? []).find((m) => isVideoType(m.type));
  return v?.url ?? post.video_url ?? null;
}

export const imageCount = (post: Post) => (post.media ?? []).filter((m) => !isVideoType(m.type) && !isDocType(m.type)).length;

// Derived from DiscoverItem.tileHeightFactor in Flutter (height/width clamped to 0.8..1.6), expressed as width/height.
export function tileAspect(ar: number | null | undefined, hasImage: boolean): number {
  if (!hasImage) return 1;
  if (ar && ar > 0) return Math.min(1.25, Math.max(0.625, ar));
  return 1 / 1.2;
}

export function aspectOf(item: DiscoverItem): number {
  const c = coverOf(item.post);
  return tileAspect(c.aspect, item.kind === "listing" ? true : !!c.url);
}
