import { api } from "./client";
import { mediaUrl } from "./feed";
import type { Post } from "./feed-types";

// Contracts read from users-show, users-posts, users-listings, users-reposts, posts-liked, bookmarks-list,
// users-followers/following, follows-notify, users-block, blocks-list and conversations-open (via Flutter).
export interface UserProfile {
  id: number;
  name: string | null;
  username: string;
  bio: string | null;
  tagline: string | null;
  avatar: string | null;
  cover: string | null;
  is_verified: boolean;
  campus_verified: boolean;
  campus_role: string | null;
  location: string | null;
  links: string[];
  institution: { id: number; name: string; short_name: string | null } | null;
  counts: { posts: number; listings: number; followers: number; following: number; communities: number };
  is_following: boolean;
  is_own_profile: boolean;
}
type RawProfile = Omit<UserProfile, "links"> & { links?: unknown };

export interface FollowUser {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_verified: boolean;
  is_following: boolean;
}

export interface CursorPage {
  data?: Post[];
  next_cursor?: string | null;
  has_more?: boolean;
}

const enc = encodeURIComponent;

function normProfile(p: RawProfile): UserProfile {
  return {
    ...p,
    avatar: mediaUrl(p.avatar),
    cover: mediaUrl(p.cover),
    links: Array.isArray(p.links) ? p.links.filter((l): l is string => typeof l === "string" && l.trim() !== "") : [],
  };
}

export const usersApi = {
  profile: async (username: string, signal?: AbortSignal) =>
    normProfile(await api.get<RawProfile>(`users-show/${enc(username)}`, undefined, signal)),

  posts: (username: string, cursor: string | null, signal?: AbortSignal) =>
    api.get<CursorPage>(`users-posts/${enc(username)}`, { cursor }, signal),
  listings: (username: string, cursor: string | null, signal?: AbortSignal) =>
    api.get<CursorPage>(`users-listings/${enc(username)}`, { cursor }, signal),
  reposts: (username: string, page: number, signal?: AbortSignal) =>
    api.get<{ data?: Post[]; has_more?: boolean }>(`users-reposts/${enc(username)}`, { page }, signal),
  liked: (cursor: string | null, signal?: AbortSignal) => api.get<CursorPage>("posts-liked", { cursor }, signal),
  saved: (page: number, signal?: AbortSignal) =>
    api.get<{ data?: { bookmarked_at?: string; post?: Post }[]; has_more?: boolean }>("bookmarks-list", { page }, signal),

  followList: async (kind: "followers" | "following", username: string, page: number, signal?: AbortSignal) => {
    const r = await api.get<{ data?: FollowUser[]; has_more?: boolean }>(`users-${kind}/${enc(username)}`, { page }, signal);
    return { data: (r.data ?? []).map((u) => ({ ...u, avatar: mediaUrl(u.avatar) })), has_more: r.has_more === true };
  },

  notifyGet: async (id: number) => (await api.get<{ notify?: boolean }>(`follows-notify/${id}`)).notify === true,
  notifyToggle: async (id: number) => (await api.post<{ notify?: boolean }>(`follows-notify/${id}`, {})).notify === true,
  blockedIds: async () => new Set(((await api.get<{ data?: { id: number }[] }>("blocks-list")).data ?? []).map((u) => u.id)),
  toggleBlock: async (id: number) => (await api.post<{ blocked?: boolean }>(`users-block/${id}`, {})).blocked === true,
  openConversation: (userId: number) => api.post<{ conversation_id: number }>("conversations-open", { user_id: userId }),
};
