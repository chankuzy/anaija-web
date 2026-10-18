import { api } from "./client";
import type { FeedItem, FeedMedia, FeedResponse, FeedScope, Post } from "./feed-types";

const STORAGE_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://eqwcndxdbfljsjxsduid.supabase.co").replace(/\/+$/, "") +
  "/storage/v1/object/public/media/";

// Port of normalizeMediaUrl() in models.dart: absolute stays, "//x" gets https, relative keys get the storage base.
export function mediaUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return STORAGE_BASE + t.replace(/^\/+/, "");
}

const normMedia = (m: FeedMedia): FeedMedia => ({ ...m, url: mediaUrl(m.url), thumbnail: mediaUrl(m.thumbnail) });

export const normPost = (p: Post): Post => ({
  ...p,
  video_url: mediaUrl(p.video_url),
  thumbnail_url: mediaUrl(p.thumbnail_url),
  media: (p.media ?? []).map(normMedia),
});

const normItem = (i: FeedItem): FeedItem => (i.type === "post" ? { ...i, post: normPost(i.post) } : i);

export const feedApi = {
  // Guests use feed-public (no token, public posts only); signed-in users use feed.
  page: async (o: {
    authed: boolean;
    scope: FeedScope;
    cursor?: string | null;
    refresh?: boolean;
    signal?: AbortSignal;
  }): Promise<FeedResponse> => {
    const res = o.authed
      ? await api.get<FeedResponse>("feed", { scope: o.scope, cursor: o.cursor, refresh: o.refresh ? 1 : undefined }, o.signal)
      : await api.get<FeedResponse>("feed-public", { cursor: o.cursor, refresh: o.refresh ? 1 : undefined }, o.signal);
    return { ...res, items: (res.items ?? []).map(normItem) };
  },
};
