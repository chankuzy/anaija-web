import { api } from "./client";
import { normPost } from "./feed";
import type { Post } from "./feed-types";

// posts-show returns the formatted post/listing directly. 404 = gone, 410 = expired story.
export const postDetailApi = {
  get: async (id: number, signal?: AbortSignal) => normPost(await api.get<Post>(`posts-show/${id}`, undefined, signal)),
};
