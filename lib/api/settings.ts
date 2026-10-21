import { api } from "./client";
import { mediaUrl } from "./feed";

// Contracts read from Flutter: content-settings (GET/PATCH), blocks-list, users-block (toggle), reports-store.
export interface ContentSettings {
  allow_story_sharing: boolean;
  feed_start_muted: boolean;
  feed_autoplay_video: boolean;
}

export interface BlockedUser {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
}

export const settingsApi = {
  content: async (signal?: AbortSignal): Promise<ContentSettings> => {
    const r = await api.get<Partial<ContentSettings>>("content-settings", undefined, signal);
    return {
      allow_story_sharing: r.allow_story_sharing ?? true,
      feed_start_muted: r.feed_start_muted ?? false,
      feed_autoplay_video: r.feed_autoplay_video ?? true,
    };
  },
  setContent: (body: Partial<ContentSettings>) => api.patch("content-settings", body),

  blocked: async (signal?: AbortSignal): Promise<BlockedUser[]> =>
    ((await api.get<{ data?: BlockedUser[] }>("blocks-list", undefined, signal)).data ?? []).map((u) => ({
      ...u,
      avatar: mediaUrl(u.avatar),
    })),
  // users-block toggles. If our list was stale and it re-blocked, toggle once more (same as Flutter).
  unblock: async (id: number) => {
    const r = await api.post<{ blocked?: boolean }>(`users-block/${id}`, {});
    if (r.blocked === true) await api.post(`users-block/${id}`, {});
  },

  report: (category: string, message: string) => api.post("reports-store", { category, message }),
};
