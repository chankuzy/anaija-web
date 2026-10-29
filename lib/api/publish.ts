import { api } from "./client";

export interface MediaInput {
  type: "image" | "video" | "document";
  storage_key: string;
  thumbnail_key?: string;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  duration_seconds?: number;
  size_bytes: number;
  mime_type: string;
}

export interface StoreResult {
  post_id: number;
  type: string;
  status: string;
  duplicate?: boolean;
}

// Contract read from posts-store + postService.createPost. client_request_id makes the call idempotent.
export const publishApi = {
  // `community` (a slug) routes the same body through the community gate instead of the personal feed.
  store: ({ community, ...body }: Record<string, unknown>) =>
    typeof community === "string" && community
      ? api.post<StoreResult>(`communities/post/${encodeURIComponent(community)}`, body)
      : api.post<StoreResult>("posts-store", body),
};
