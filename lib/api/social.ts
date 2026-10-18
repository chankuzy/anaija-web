import { api } from "./client";

// Contracts read from users-follow, posts-repost, posts-share, feed-feedback, posts-destroy, feed-events.
export const socialApi = {
  toggleFollow: (id: number) =>
    api.post<{ following?: boolean; is_following?: boolean }>(`users-follow/${id}`, {}),
  toggleRepost: (id: number) =>
    api.post<{ reposted?: boolean; reposts_count?: number }>(`posts-repost/${id}`, {}),
  share: (id: number) => api.post<{ shares_count: number; share_url: string | null }>(`posts-share/${id}`, {}),
  feedback: (postId: number, kind: "not_interested" | "hide_creator") =>
    api.post<{ ok: boolean }>("feed-feedback", { post_id: postId, kind }),
  deletePost: (id: number) => api.delete<{ message: string }>(`posts-destroy/${id}`),
  sendEvents: (events: unknown[]) => api.post<{ accepted?: number }>("feed-events", { events }),
};
