import { api } from "./client";

// Paths mirror Flutter: POST /posts-like/{id}, POST /posts-bookmark/{id} (server toggles).
export const postsApi = {
  toggleLike: (id: number) => api.post<{ liked: boolean; likes_count?: number }>(`posts-like/${id}`, {}),
  toggleBookmark: (id: number) => api.post<{ bookmarked: boolean; bookmarks_count?: number }>(`posts-bookmark/${id}`, {}),
};
