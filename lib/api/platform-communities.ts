import { api } from "./client";

export interface PlatformCommunity {
  key: string;
  id: number;
  name: string;
  slug: string;
  description: string;
  join_policy: string | null;
  read_policy: string | null;
  permissions: Record<string, string>;
  discoverability: string;
  listed: boolean;
  is_active: boolean;
  status: string;
  members: number;
}

export const PERMISSION_ACTIONS = [
  { key: "post", label: "Post in the feed", def: "member" },
  { key: "chat", label: "Send chat messages", def: "member" },
  { key: "invite", label: "Create invites", def: "moderator" },
  { key: "session", label: "Start live sessions", def: "moderator" },
  { key: "announce", label: "Post announcements", def: "moderator" },
  { key: "library", label: "Add to the library", def: "moderator" },
] as const;

const base = (key: string) => `platform/communities/${encodeURIComponent(key)}`;

export const platformCommunitiesApi = {
  list: async (): Promise<PlatformCommunity[]> =>
    (await api.get<{ data?: PlatformCommunity[] }>("platform/communities")).data ?? [],
  get: (key: string) => api.get<PlatformCommunity>(base(key)),
  update: (key: string, body: { description?: string; permissions?: Record<string, string> }) =>
    api.patch<PlatformCommunity>(base(key), body),
  setListing: (key: string, listed: boolean) => api.post<PlatformCommunity>(`${base(key)}/listing`, { listed }),
};
