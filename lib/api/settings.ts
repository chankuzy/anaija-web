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

export interface Institution {
  id: number;
  name: string;
  short_name: string | null;
  slug: string | null;
  logo_url: string | null;
}

export interface CampusProfile {
  institution: { id: number; name: string; short_name: string | null } | null;
  faculty: string | null;
  level: string | null;
  campus_role: string | null;
}

export interface NotifPrefs {
  push_enabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  hide_message_preview: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
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

  notifPrefs: async (signal?: AbortSignal): Promise<NotifPrefs> => {
    const r = await api.get<Partial<NotifPrefs>>("notifications-preferences-get", undefined, signal);
    return {
      push_enabled: r.push_enabled ?? true,
      likes: r.likes ?? true,
      comments: r.comments ?? true,
      follows: r.follows ?? true,
      messages: r.messages ?? true,
      hide_message_preview: r.hide_message_preview ?? false,
      quiet_hours_enabled: r.quiet_hours_enabled ?? false,
      quiet_hours_start: r.quiet_hours_start ?? null,
      quiet_hours_end: r.quiet_hours_end ?? null,
    };
  },
  // Full set + the browser's current UTC offset (east-positive, like Dart's timeZoneOffset.inMinutes).
  setNotifPrefs: (p: NotifPrefs) =>
    api.post("notifications-preferences-update", { ...p, timezone_offset_minutes: -new Date().getTimezoneOffset() }),

  // Campus: institutions-list?search=, profile-get (faculty/level/campus_role), institutions-join.
  institutions: async (search: string, signal?: AbortSignal): Promise<Institution[]> =>
    (await api.get<{ data?: Institution[] }>("institutions-list", { search }, signal)).data ?? [],
  campus: (signal?: AbortSignal) => api.get<CampusProfile>("profile-get", undefined, signal),
  joinInstitution: (body: { institution_id: number; faculty: string | null; level: string | null; campus_role: string }) =>
    api.post("institutions-join", body),
};
