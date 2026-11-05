import { api } from "./client";
import { mediaUrl } from "./feed";
import type { Community } from "./communities";

export interface PulseCommunity { id: number; name: string; slug: string; avatar: string | null }
export interface PulseSession {
  id: number; code: string; title: string; status: "scheduled" | "live"; starts_at: string | null; ends_at: string | null;
  posts_count: number; participants_count: number; community: PulseCommunity;
}
export interface PulsePost { id: number; title: string; created_at: string; pinned?: boolean; comments?: number; community: PulseCommunity }
export interface PulseEvent { id: number; title: string; event_at: string; community: PulseCommunity }
export interface PulseResource {
  id: number; post_id: number; title: string; doc_type: string; course_code: string | null; created_at: string; community: PulseCommunity;
}
export interface Pulse {
  sessions: PulseSession[]; announcements: PulsePost[]; events: PulseEvent[]; discussions: PulsePost[]; resources: PulseResource[];
}

const tag = (c: PulseCommunity): PulseCommunity => ({ ...c, avatar: mediaUrl(c.avatar) });
const com = (c: Community): Community => ({ ...c, avatar: mediaUrl(c.avatar), cover: mediaUrl(c.cover) });

export const homeApi = {
  // Contract: supabase/functions/communities/pulse.ts. Members' own communities only.
  pulse: async (): Promise<Pulse> => {
    const r = await api.get<Pulse>("communities/pulse");
    const t = <T extends { community: PulseCommunity }>(x: T): T => ({ ...x, community: tag(x.community) });
    return {
      sessions: (r.sessions ?? []).map(t), announcements: (r.announcements ?? []).map(t), events: (r.events ?? []).map(t),
      discussions: (r.discussions ?? []).map(t), resources: (r.resources ?? []).map(t),
    };
  },
  // Same endpoint as communitiesApi.discover; it already accepts institution_id server-side. `search` rides the same query.
  discoverAt: async (p: { institution_id: number; category?: string | null; search?: string; page?: number }) => {
    const r = await api.get<{ data: Community[]; has_more: boolean }>("communities/discover", p);
    return { items: r.data.map(com), hasMore: r.has_more };
  },
};
