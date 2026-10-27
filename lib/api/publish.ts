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
  store: (body: Record<string, unknown>) => api.post<StoreResult>("posts-store", body),
};
