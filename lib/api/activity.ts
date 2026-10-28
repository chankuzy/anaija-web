import { api } from "./client";
import { mediaUrl, normPost } from "./feed";
import type { Post } from "./feed-types";

export type ActivityFilter = "all" | "unread" | "likes" | "comments" | "follows";

export interface ActivityActor {
  id: number;
  name: string;
  username: string;
  avatar: string | null;
}
export interface ActivityDest {
  kind: string;
  post_id?: number | null;
  comment_id?: number | null;
  conversation_id?: number | null;
  user_id?: number | null;
  item_id?: number | null;
  username?: string | null;
  slug?: string | null;
  code?: string | null;
  tab?: string | null;
  title?: string | null;
  avatar?: string | null;
}
export interface ActivityItem {
  id: number; // negative = conversation row (-conversationId), cleared by reading the chat
  kind: string;
  title: string;
  preview: string | null;
  quote: boolean;
  actors: ActivityActor[];
  actor_count: number;
  thumb: string | null;
  thumb_count: number;
  content: ActivityDest | null;
  destination: ActivityDest;
  is_read: boolean;
  last_event_at: string;
  follow_back: boolean | null;
}
interface RawList {
  data?: ActivityItem[];
  next_cursor?: string | null;
  has_more?: boolean;
  unread_count?: number;
}

const norm = (i: ActivityItem): ActivityItem => ({
  ...i,
  preview: i.preview ?? null,
  quote: i.quote === true,
  actors: (i.actors ?? []).map((a) => ({ ...a, avatar: mediaUrl(a.avatar) })),
  thumb: mediaUrl(i.thumb),
  thumb_count: i.thumb_count ?? 1,
  content: i.content ?? null,
  destination: i.destination ?? { kind: "none" },
  follow_back: i.follow_back ?? null,
});

// Contracts read from supabase/functions/activity + activityService.ts.
export const activityApi = {
  list: async (filter: ActivityFilter, cursor: string | null, signal?: AbortSignal) => {
    const r = await api.get<RawList>("activity/list", { filter, cursor }, signal);
    return {
      items: (r.data ?? []).map(norm),
      cursor: r.next_cursor ?? null,
      hasMore: r.has_more === true,
      unread: r.unread_count ?? 0,
    };
  },
  seen: (upTo: string) => api.post("activity/seen", { up_to: upTo }),
  read: (id: number) => api.post("activity/read", { id }),
  readAll: () => api.post("activity/read", { all: true }),
  dismiss: (id: number) => api.post("activity/dismiss", { id }),
  counts: () => api.get<{ unseen: number; unread: number; topic: string | null }>("activity/counts"),
  targets: async (id: number): Promise<Post[]> =>
    ((await api.get<{ data?: Post[] }>("activity/targets", { id })).data ?? []).map(normPost),
};
