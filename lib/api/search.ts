import { api } from "./client";
import { mediaUrl, normPost } from "./feed";
import type { Post } from "./feed-types";

export interface SearchUser {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_verified: boolean;
  campus_verified: boolean;
}
export interface Suggestion {
  type: "user" | "hashtag";
  value: string;
  name?: string | null;
  avatar?: string | null;
  posts_count?: number | null;
}
export interface SuggestionsRes {
  suggestions?: Suggestion[];
  trending_terms?: string[];
  trending_hashtags?: { tag: string; posts_count: number }[];
}

// Contract read from search/index.ts, searchService.ts, search-suggestions and search_providers.dart.
export const searchApi = {
  all: async (q: string, signal?: AbortSignal) => {
    const r = await api.get<{ posts?: Post[]; listings?: Post[]; users?: SearchUser[] }>("search", { q, type: "all" }, signal);
    return {
      posts: (r.posts ?? []).map(normPost),
      listings: (r.listings ?? []).map(normPost),
      users: (r.users ?? []).map((u) => ({ ...u, avatar: mediaUrl(u.avatar) })),
    };
  },
  suggestions: async (q: string, signal?: AbortSignal) => {
    const r = await api.get<SuggestionsRes>("search-suggestions", { q }, signal);
    return { ...r, suggestions: (r.suggestions ?? []).map((s) => ({ ...s, avatar: mediaUrl(s.avatar) })) };
  },
};
