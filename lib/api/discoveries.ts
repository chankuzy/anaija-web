import { api } from "./client";
import { mediaUrl } from "./feed";
import type { MatchReason, Opportunity } from "./opportunities";

export type DiscoveriesStatus = "ok" | "personalization_off" | "no_declared_data" | "nothing_yet";

export interface DiscoveredPerson { id: number; name: string | null; username: string | null; avatar: string | null; reasons: MatchReason[] }
export interface DiscoveredCommunity {
  id: number; name: string; slug?: string | null; members_count?: number; academic_origin?: "faculty" | "department" | null;
  avatar?: string | null; description?: string | null; reasons: MatchReason[]; [k: string]: unknown;
}

export type DiscoveryItem =
  | { type: "opportunity"; id: string; data: Opportunity }
  | { type: "person"; id: string; data: DiscoveredPerson }
  | { type: "community"; id: string; data: DiscoveredCommunity };

export interface DiscoveriesPage {
  items: DiscoveryItem[]; nextCursor: string | null; hasMore: boolean; caughtUp: boolean;
  status: DiscoveriesStatus; personalized: boolean; personalizationEnabled: boolean; sessionId: string | null;
}

interface Raw {
  items?: { type: string; id: string; data: unknown }[];
  next_cursor?: string | null; has_more?: boolean; caught_up?: boolean; status?: DiscoveriesStatus;
  personalized?: boolean; personalization_enabled?: boolean; session_id?: string | null;
}

// One bad item never blanks the list: unknown types are dropped, ids are de-duplicated.
export const discoveriesApi = {
  page: async (o: { cursor?: string | null; refresh?: boolean; signal?: AbortSignal } = {}): Promise<DiscoveriesPage> => {
    const res = await api.get<Raw>("users/discoveries", { cursor: o.cursor, refresh: o.refresh ? 1 : undefined }, o.signal);
    const items: DiscoveryItem[] = [];
    const seen = new Set<string>();
    for (const r of res.items ?? []) {
      if (!r || typeof r.id !== "string" || !r.data || seen.has(r.id)) continue;
      if (r.type === "opportunity") items.push({ type: "opportunity", id: r.id, data: r.data as Opportunity });
      else if (r.type === "person") {
        const d = r.data as DiscoveredPerson;
        items.push({ type: "person", id: r.id, data: { ...d, avatar: mediaUrl(d.avatar) } });
      } else if (r.type === "community") items.push({ type: "community", id: r.id, data: r.data as DiscoveredCommunity });
      else continue;
      seen.add(r.id);
    }
    return {
      items, nextCursor: res.next_cursor ?? null, hasMore: res.has_more === true, caughtUp: res.caught_up === true,
      status: res.status ?? "ok", personalized: res.personalized === true,
      personalizationEnabled: res.personalization_enabled !== false, sessionId: res.session_id ?? null,
    };
  },
};
