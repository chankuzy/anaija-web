import { api } from "./client";
import { mediaUrl } from "./feed";
import type { Policy } from "./communities";

export const MOMENT_TYPES = ["hot_seat", "verdict", "one_question", "confession_drop", "dept_war"] as const;
export type MomentType = (typeof MOMENT_TYPES)[number];
export type MomentStatus = "draft" | "scheduled" | "active" | "closed" | "completed" | "cancelled";

export interface Host { name: string | null; username: string | null; avatar: string | null }
export interface MomentCommunity { id: number; name: string; slug: string; avatar: string | null; members_count: number; join_policy: Policy; read_policy: string }

export interface HotSeatCfg { submissions_closed: boolean; answer_until: string | null; open_count: number; answered_count: number }
export interface VerdictCfg {
  my_vote: number | null; results_visible: boolean; total_votes: number | null;
  options: { idx: number; label: string; votes?: number; pct?: number }[];
}
export interface ConfessionCfg {
  reveal_at: string | null; reveal_mode: "all" | "sequential" | "manual" | null; reveal_interval_secs: number | null;
  max_per_user: number | null; approved_count: number; revealed_count: number;
}
export interface WarSide {
  side: "challenger" | "challenged"; status: "pending" | "accepted" | "declined";
  community: { id: number; name?: string; slug?: string; avatar?: string | null; members_count?: number };
  participants: number; score: number | null; eligible: boolean | null;
}
export interface WarItem {
  idx: number; kind: "choice" | "text"; prompt: string; choices: string[] | null; answered: boolean;
  correct_idx?: number | null; accepted?: string[] | null; my_correct?: boolean | null;
}
export interface WarCfg {
  challenge_type: string | null; points_per_item: number | null; min_participants: number | null; duration_minutes: number | null;
  invite_expires_at: string | null; message: string | null; winner_community_id: number | null;
  results: { community_id: number; participants: number; raw: number; score: number; eligible: boolean }[] | null;
  sides: WarSide[]; items: WarItem[]; my_side: number | null; can_join: number[]; can_respond: number[]; can_play: boolean;
}

export interface Viewer {
  authenticated: boolean; is_member: boolean; can_view: boolean; can_participate: boolean; can_comment: boolean;
  is_host: boolean; can_moderate: boolean; is_staff: boolean; blocked: boolean; muted: boolean;
  join: Policy | null; reminder: boolean; my_entries: number;
}
export interface Moment {
  id: number; code: string; path: string; type: MomentType; status: MomentStatus; title: string | null; body: string | null;
  cancel_reason: string | null; anonymous: boolean; allow_anonymous_entries: boolean; is_official: boolean;
  starts_at: string | null; ends_at: string | null; ended_at: string | null; created_at: string;
  participants_count: number; entries_count: number; realtime_key: string | null;
  host: Host | null; community: MomentCommunity; config: unknown; viewer: Viewer;
}
export interface MomentCardData {
  code: string; path: string; type: MomentType; status: MomentStatus; title: string | null; anonymous: boolean; is_official: boolean;
  starts_at: string | null; ends_at: string | null; reveal_at: string | null; community_id: number;
  participants_count: number; entries_count: number; created_at: string;
}
export interface MomentLists { live: MomentCardData[]; upcoming: MomentCardData[]; recent: MomentCardData[]; invites: MomentCardData[] }

export type Author = { anonymous: true; alias: string } | { anonymous: false; name: string | null; username: string | null; avatar: string | null };
export interface Entry {
  id: number; parent_id: number | null; kind: string; body: string; answer: string | null; answered_at: string | null; status: string;
  author: Author; upvotes_count: number; reactions_count: number; replies_count: number; reveal_at: string | null; created_at: string;
  is_mine: boolean; my_reaction: string | null; side_community_id?: number | null;
}
export interface EntryPage { entries: Entry[]; next_cursor: string | null; has_more: boolean; locked: boolean }
export interface QueueItem { id: number; body: string; flags: string[]; created_at: string; can_approve: boolean }
export interface MomentReport {
  id: number; entry_id: number | null; reason: string; details: string | null; status: string; created_at: string;
  preview: { kind: string; body: string; alias: string | null; removed: boolean } | null;
}
export interface PermInfo { can: Record<MomentType, boolean>; settings: Record<string, string> | null }

export const cfgOf = <T>(m: Moment) => (m.config ?? {}) as T;
export const newKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 32);

const person = <T extends { avatar: string | null }>(p: T): T => ({ ...p, avatar: mediaUrl(p.avatar) });
function normMoment(m: Moment): Moment {
  let config = m.config;
  if (m.type === "dept_war") {
    const w = m.config as WarCfg | null;
    if (w?.sides) config = { ...w, sides: w.sides.map((s) => ({ ...s, community: { ...s.community, avatar: mediaUrl(s.community.avatar ?? null) } })) };
  }
  return { ...m, host: m.host ? person(m.host) : null, community: { ...m.community, avatar: mediaUrl(m.community.avatar) }, config };
}
const normEntry = (e: Entry): Entry => (e.author.anonymous ? e : { ...e, author: { ...e.author, avatar: mediaUrl(e.author.avatar) } });

const M = (p: string) => `moments/${p}`;
const enc = encodeURIComponent;
const ok = { ok: true as boolean };

export const momentsApi = {
  settings: (id: number) => api.get<PermInfo>(M(`settings/${id}`)),
  saveSettings: (id: number, body: Record<string, string>) => api.post<{ settings: Record<string, string> }>(M(`settings/${id}`), body),
  create: async (id: number, body: Record<string, unknown>) => normMoment((await api.post<{ moment: Moment }>(M(`create/${id}`), body)).moment),
  list: (ref: string) => api.get<MomentLists>(M(`community/${enc(ref)}`)),
  show: async (code: string) => normMoment((await api.get<{ moment: Moment }>(M(`show/${enc(code)}`))).moment),
  end: (code: string) => api.post<{ status: string }>(M(`end/${enc(code)}`)),
  cancel: (code: string, reason?: string) => api.post<{ status: string }>(M(`cancel/${enc(code)}`), { reason }),
  remind: (code: string) => api.post<{ reminder: boolean }>(M(`remind/${enc(code)}`)),

  entries: async (code: string, p: { filter?: string; sort?: string; cursor?: string | null }): Promise<EntryPage> => {
    const r = await api.get<EntryPage>(M(`entries/${enc(code)}`), p);
    return { ...r, entries: r.entries.map(normEntry) };
  },
  replies: async (code: string, entryId: number) =>
    (await api.get<{ replies: Entry[] }>(M(`replies/${enc(code)}`), { entry_id: entryId })).replies.map(normEntry),
  entry: async (code: string, body: Record<string, unknown>) => {
    const r = await api.post<{ entry: Entry; pending?: boolean; duplicate?: boolean }>(M(`entry/${enc(code)}`), body);
    return { ...r, entry: normEntry(r.entry) };
  },
  react: (code: string, entryId: number, kind = "like") =>
    api.post<{ count: number; my_reaction: string | null }>(M(`react/${enc(code)}`), { entry_id: entryId, kind }),
  vote: (code: string, optionIdx: number) => api.post<{ config: VerdictCfg }>(M(`vote/${enc(code)}`), { option_idx: optionIdx }),
  answer: async (code: string, body: { entry_id: number; action: "answer" | "skip" | "dismiss" | "reopen"; answer?: string }) =>
    normEntry((await api.post<{ entry: Entry }>(M(`answer/${enc(code)}`), body)).entry),

  queue: async (code: string) => (await api.get<{ entries: QueueItem[] }>(M(`queue/${enc(code)}`))).entries,
  moderate: (code: string, body: { entry_id: number; action: "remove" | "approve" | "reject"; reason?: string; block?: boolean }) =>
    api.post<typeof ok>(M(`moderate/${enc(code)}`), body),
  reveal: (code: string, body: { count?: number; all?: boolean }) => api.post<{ revealed: number }>(M(`reveal/${enc(code)}`), body),
  report: (code: string, body: { reason: string; entry_id?: number; details?: string }) => api.post<typeof ok>(M(`report/${enc(code)}`), body),
  reports: async (code: string) => (await api.get<{ data: MomentReport[] }>(M(`reports/${enc(code)}`))).data,
  reportHandle: (code: string, body: { report_id: number; action: "dismiss" | "remove"; block?: boolean }) =>
    api.post<{ status: string }>(M(`report-handle/${enc(code)}`), body),

  warRespond: (code: string, action: "accept" | "decline") => api.post<{ status: string }>(M(`war/respond/${enc(code)}`), { action }),
  warJoin: (code: string, communityId: number) => api.post<{ side: number }>(M(`war/join/${enc(code)}`), { community_id: communityId }),
  warAnswer: (code: string, body: { idx: number; choice_idx?: number; text?: string }) => api.post<{ saved: boolean }>(M(`war/answer/${enc(code)}`), body),
  warSubmit: async (code: string, body: { body: string; anonymous: boolean; client_key: string }) =>
    normEntry((await api.post<{ entry: Entry }>(M(`war/submit/${enc(code)}`), body)).entry),
  warEntries: async (code: string, cursor: string | null): Promise<EntryPage> => {
    const r = await api.get<Omit<EntryPage, "locked">>(M(`war/entries/${enc(code)}`), { cursor });
    return { ...r, locked: false, entries: r.entries.map(normEntry) };
  },
  warVote: (code: string, entryId: number) => api.post<{ count: number; my_reaction: string | null }>(M(`war/vote/${enc(code)}`), { entry_id: entryId }),
  warRemove: (code: string, entryId: number, reason?: string) => api.post<typeof ok>(M(`war/remove/${enc(code)}`), { entry_id: entryId, reason }),
};
