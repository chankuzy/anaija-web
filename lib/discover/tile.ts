import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";

const isVideoType = (t: string | null | undefined) => (t ?? "").toLowerCase().includes("video");

export function coverOf(post: Post) {
  const m = [...(post.media ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ?? null;
  const isVideo = m ? isVideoType(m.type) : !!post.video_url;
  const url = m ? (isVideo ? (m.thumbnail ?? post.thumbnail_url) : (m.url ?? m.thumbnail)) : post.thumbnail_url;
  const c = m?.dominant_color?.trim() ?? "";
  const color = /^#?[0-9a-f]{6}$/i.test(c) ? (c.startsWith("#") ? c : `#${c}`) : null;
  return { url: url || null, isVideo, aspect: m?.aspect_ratio ?? null, color };
}

export const imageCount = (post: Post) => (post.media ?? []).filter((m) => !isVideoType(m.type)).length;

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
