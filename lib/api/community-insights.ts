import { api } from "./client";

// Contract: supabase/functions/communities/insights.ts. Every figure is counted from real rows.
export interface InsightsWeek { w: number; active: number; acts: number }
export interface Insights {
  window_days: number; generated_at: string; community_created_at: string;
  /** False until the community is 60+ days old: no period-on-period comparison is shown before that. */
  history_complete: boolean;
  members: number; base_members: number; new_members: number; new_members_prev: number;
  activity: {
    active: number; prev_active: number; returning: number; newly_active: number;
    contributions: number; contributions_prev: number;
    by_kind: { posts: number; comments: number; votes: number; chat: number };
    /** Oldest first, 12 weeks. */
    weeks: InsightsWeek[];
  };
  joins_weekly: { w: number; joined: number }[];
  content: { total: number; total_prev: number; announcements: number; polls: number; documents: number; articles: number; questions: number; posts: number };
  discussion: { comments: number; replies: number; discussions: number; total_prev: number };
  polls: { voters: number; voters_prev: number; published: number };
  resources: { added: number; interactions: number };
  by_type: { type: string; posts: number; interactors: number }[];
  health: { open_reports: number; reports_cur: number };
  tracking: { since: string | null; visitors: number; visitors_prev: number } | null;
}
export interface ContentRow {
  id: number; type: string; preview: string; created_at: string; pinned: boolean;
  author: { name: string | null; username: string | null };
  /** null = reach tracking has not started. reach_partial = the post is older than tracking, so this is a lower bound. */
  viewers: number | null; reach_partial: boolean;
  interactions: number; interactors: number; response: number | null;
}
export interface ContentPage { items: ContentRow[]; has_more: boolean }

const C = (p: string) => `communities/${p}`;

export const insightsApi = {
  overview: (id: number) => api.get<Insights>(C(`insights/${id}`)),
  content: (id: number, p: { type?: string | null; sort?: "recent" | "top"; page?: number }) =>
    api.get<ContentPage>(C(`insights-content/${id}`), { type: p.type ?? undefined, sort: p.sort, page: p.page }),
};
