import { api } from "./client";

export type ContentStatus = "draft" | "scheduled" | "publishing" | "published" | "archived";

export interface ContentMedia {
  type: "image" | "video";
  storage_key: string;
  thumbnail_key?: string | null;
  width?: number;
  height?: number;
  duration_seconds?: number;
  size_bytes?: number;
  mime_type?: string;
  aspect_ratio?: number;
  url?: string | null;
  thumbnail_url?: string | null;
}

export interface ContentStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reposts: number;
  saves: number;
  impressions: number;
  delivered: number;
  completions: number;
  skips: number;
  negatives: number;
  follows_from: number;
}

export interface ContentItem {
  id: number;
  status: ContentStatus;
  account: { key: string; status: string; name: string | null; username: string | null; avatar: string | null } | null;
  caption: string;
  visibility: string;
  allow_comments: boolean;
  media: ContentMedia[];
  scheduled_at: string | null;
  published_at: string | null;
  post_id: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  stats: ContentStats | null;
  can: { edit: boolean; publish: boolean; archive: boolean };
}

export interface ContentPayload {
  caption?: string;
  visibility?: string;
  allow_comments?: boolean;
  media?: ContentMedia[];
}

const one = (id: number) => `platform/content/${id}`;

export const platformContentApi = {
  list: (q: { account?: string; status?: string; cursor?: string | null }) =>
    api.get<{ data: ContentItem[]; next_cursor: string | null }>("platform/content", q),
  get: (id: number) => api.get<ContentItem>(one(id)),
  create: (body: { account: string; payload: ContentPayload }) => api.post<ContentItem>("platform/content", body),
  update: (id: number, payload: ContentPayload) => api.patch<ContentItem>(one(id), { payload }),
  schedule: (id: number, at: string) => api.post<ContentItem>(`${one(id)}/schedule`, { at }),
  unschedule: (id: number) => api.post<ContentItem>(`${one(id)}/unschedule`, {}),
  publish: (id: number) => api.post<ContentItem>(`${one(id)}/publish`, {}),
  archive: (id: number) => api.post<ContentItem>(`${one(id)}/archive`, {}),
};
