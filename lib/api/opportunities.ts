import { api } from "./client";
import { mediaUrl } from "./feed";

export interface MatchReason { code: string; label: string }
export interface MatchedPerson {
  id: number; name: string | null; username: string | null; avatar: string | null;
  reason: string; reasons: MatchReason[];
}
/** insufficient=true means "not enough declared data to match": show honest alternatives, never filler. */
export interface PeopleMatches { data: MatchedPerson[]; personalization_enabled: boolean; insufficient: boolean }

export type OpportunityVerification = "verified" | "unverified" | "self_reported" | "rejected";
export interface Opportunity {
  id: number; kind: string; title: string; summary: string; requirements: string | null;
  provider_name: string | null; source_type: string; source_url: string | null;
  /** Where this listing came from. Always shown. */
  provenance: string;
  verification: OpportunityVerification; verification_label: string; verified_at: string | null;
  apply_method: "external_link" | "in_app" | "contact"; apply_url: string | null;
  location_mode: string | null; location_text: string | null;
  opens_at: string | null; expires_at: string | null; is_rolling: boolean;
  skills: { id: number; label: string; required: boolean }[];
  interests: { id: number; label: string }[];
  seek_kinds: { id: number; label: string }[];
  reasons: MatchReason[]; saved: boolean;
}
export interface OpportunityList {
  data: Opportunity[]; has_more: boolean; personalized: boolean; personalization_enabled: boolean;
}
export type OpportunityAction = "save" | "unsave" | "dismiss" | "undismiss" | "apply_click" | "view";

export const opportunitiesApi = {
  peopleMatches: async (limit = 6): Promise<PeopleMatches> => {
    const r = await api.get<PeopleMatches>("users/people-matches", { limit });
    return { ...r, data: (r.data ?? []).map((p) => ({ ...p, avatar: mediaUrl(p.avatar) })) };
  },
  list: (p: { limit?: number; offset?: number; kind?: string; saved?: boolean } = {}) => {
    const q: Record<string, string | number> = { limit: p.limit ?? 20, offset: p.offset ?? 0 };
    if (p.kind) q.kind = p.kind;
    if (p.saved) q.saved = 1;
    return api.get<OpportunityList>("users/opportunities", q);
  },
  act: (id: number, action: OpportunityAction) => api.post<{ ok: boolean }>(`users/opportunity-action/${id}`, { action }),
};
