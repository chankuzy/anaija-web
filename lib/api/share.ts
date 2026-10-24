import { api, ApiError } from "./client";
import { mediaUrl } from "./feed";
import { listOf, rec, str } from "./parse";

// A person a post can be sent to. `id` is the user id (it is also the paging key).
export interface ShareTarget {
  id: number;
  name: string;
  username: string;
  avatar: string | null;
  conversationId: number | null; // set when a chat with them already exists
}

export const shareApi = {
  // Port of _loadFollowingPage: /users-following/{username}?page=N
  following: async (username: string, page: number, signal?: AbortSignal) => {
    const raw = await api.get<unknown>(`users-following/${encodeURIComponent(username)}`, { page }, signal);
    const items: ShareTarget[] = listOf(raw, ["data"]).flatMap((j) => {
      const r = rec(j);
      if (typeof r.id !== "number") return [];
      return [
        {
          id: r.id,
          name: str(r.name) ?? "",
          username: str(r.username) ?? "",
          avatar: mediaUrl(str(r.avatar)),
          conversationId: null,
        },
      ];
    });
    const r = rec(raw);
    const flag = r.has_more ?? r.hasMore;
    return { items, hasMore: typeof flag === "boolean" ? flag : items.length >= 30 };
  },

  openConversation: async (userId: number): Promise<number> => {
    const r = rec(await api.post<unknown>("conversations-open", { user_id: userId }));
    if (typeof r.conversation_id !== "number") throw new ApiError(0, "Couldn't open the chat.");
    return r.conversation_id;
  },

  sendPost: (conversationId: number, postId: number, tempId: string) =>
    api.post<unknown>(`conversations-send/${conversationId}`, {
      type: "post_share",
      shared_post_id: postId,
      client_temp_id: tempId,
    }),

  // Bumps the post's share counter. Best effort, like Flutter.
  count: async (postId: number): Promise<number | null> => {
    try {
      const r = await api.post<{ shares_count?: number }>(`posts-share/${postId}`, {});
      return typeof r.shares_count === "number" ? r.shares_count : null;
    } catch {
      return null;
    }
  },

  addToStory: (postId: number, requestId: string) =>
    api.post<{ story_id?: number; duplicate?: boolean; message?: string }>(`posts-add-to-story/${postId}`, {
      client_request_id: requestId,
    }),
};
