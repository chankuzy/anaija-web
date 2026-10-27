import type { FeedMedia, Post } from "@/lib/api/feed-types";
import { structuredOf } from "./structured";

/**
 * How a post is presented on Home. The backend has one post identity ("post" | "listing"); presentation is derived.
 * Adding a kind here makes TypeScript demand a renderer for it in components/home/renderers/index.ts.
 */
export type ContentKind = "reel" | "audioReel" | "gallery" | "listing" | "text" | "poll" | "document" | "publication" | "announcement";

const mediaType = (m: FeedMedia) => (m.type ?? "").toLowerCase();
export const isVideoMedia = (m: FeedMedia) => mediaType(m) === "video";
export const isImageMedia = (m: FeedMedia) => ["image", "photo", "picture"].includes(mediaType(m));
export const sortedMedia = (p: Post): FeedMedia[] =>
  [...(p.media ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

// First match wins. A future type (document, poll, editorial, announcement) adds a resolver ABOVE the media rules,
// keyed on whatever discriminator the backend ships. Nothing here guesses at fields that do not exist yet.
const STRUCTURED_KIND = { poll: "poll", document: "document", article: "publication", announcement: "announcement" } as const;
const RESOLVERS: ((p: Post) => ContentKind | null)[] = [
  (p) => {
    const s = structuredOf(p);
    return s ? STRUCTURED_KIND[s.kind] : null;
  },
  (p) => (p.type === "listing" || p.listing ? "listing" : null),
  (p) => (p.media?.some(isVideoMedia) || p.video_url ? "reel" : null),
  (p) => (isReelEligible(p) ? "audioReel" : null), // images with playable audio (videos matched above)
  (p) => (p.media?.some(isImageMedia) ? "gallery" : null),
];

export function contentKind(p: Post): ContentKind {
  for (const r of RESOLVERS) {
    const k = r(p);
    if (k) return k;
  }
  return "text";
}

// A post with no media and no words has nothing to show.
export const hasRenderableContent = (p: Post) => contentKind(p) !== "text" || !!(p.caption ?? "").trim();

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const ratioOf = (m: FeedMedia | undefined): number | null => {
  if (!m) return null;
  if (m.aspect_ratio && m.aspect_ratio > 0) return m.aspect_ratio;
  if (m.width && m.height) return m.width / m.height;
  return null;
};

// Width / height of the media frame. Images keep 4:5 .. 1.91:1; reels sit taller (9:16 is cropped to 0.66).
export function frameAspect(kind: ContentKind, p: Post): number {
  const media = sortedMedia(p);
  if (kind === "reel") return clamp(ratioOf(media.find(isVideoMedia)) ?? 0.5625, 0.66, 1.25);
  return clamp(ratioOf(media.find(isImageMedia)) ?? 1, 0.8, 1.91);
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Reels surface eligibility (mirrors feed_is_reel in SQL and isReelPost in the feed engine): a standalone post that is
// a video, or images carrying playable audio. Listings, silent images, carousels and everything else are not reels.
export function isReelEligible(p: Post): boolean {
  if (p.type !== "post") return false;
  if (p.video_url || p.media?.some(isVideoMedia)) return true;
  return !!p.audio?.enabled && !!p.audio.url && !!p.media?.some(isImageMedia);
}
