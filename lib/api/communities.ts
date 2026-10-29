import { api } from "./client";
import { mediaUrl, normPost } from "./feed";
import type { Post } from "./feed-types";

export type Role = "owner" | "admin" | "moderator" | "member";
export type DesigKind = "class_rep" | "course_rep" | "dept_exec" | "contributor";
export type Policy = "open" | "request" | "invite";
export interface Desig { id?: number; kind: DesigKind; scope_label: string | null }

export interface Community {
  id: number; name: string; slug: string; description: string | null; avatar: string | null; cover: string | null;
  category: string; institution_id: number | null; faculty: string | null; department: string | null; level: string | null;
  course_code: string | null; academic_session: string | null; members_count: number; posts_count: number;
  discoverability: "listed" | "unlisted"; join_policy: Policy; read_policy: "public_preview" | "members_only";
  status: string; is_member: boolean; my_role: Role | null; request_status: "pending" | null;
}
export interface MineRow extends Community { chat_conversation_id: number | null; chat_unread: number }
export interface Can {
  read: boolean; post: boolean; chat: boolean; invite: boolean; session: boolean; announce: boolean; library: boolean;
  moderate: boolean; manage: boolean;
}
export interface Person { id: number; name: string | null; username: string | null; avatar: string | null }
export interface Staff extends Person { role: Role; designations: Desig[] }
export interface CommunityDetail extends Community {
  rules: { text: string }[]; links: { label: string; url: string }[]; permissions: Record<string, Role> | null;
  staff: Staff[]; my_designations: Desig[]; chat_conversation_id: number | null; can: Can;
  face_pile: Person[];
}
export type CPost = Post & { community_pinned?: boolean };
export interface Member extends Person { is_verified: boolean; campus_verified: boolean; role: Role; joined_at: string; designations: Desig[] }
export interface JoinRequest { id: number; message: string | null; created_at: string; user: Person }
export interface Invite {
  id: number; token: string; label: string | null; max_uses: number | null; uses: number;
  expires_at: string | null; revoked_at?: string | null; created_at: string; path: string;
}
export interface InvitePreview {
  state: "valid" | "expired" | "exhausted" | "invalid"; is_member?: boolean;
  community?: { name: string; slug: string; avatar: string | null; members_count: number };
}
export interface Report {
  id: number; target_kind: string; target_id: number; reason: string; details: string | null; status: string; created_at: string;
  preview: { text: string | null; author_id: number | null } | null;
}
export interface JoinResult { status: string; is_member?: boolean; request_status?: string | null; members_count?: number }

export interface SessionCard {
  id: number; code: string; path: string; title: string; status: "scheduled" | "live" | "ended";
  starts_at: string | null; ends_at: string | null; posts_count: number; participants_count: number; created_at: string;
}
export interface SessionInfo {
  id: number; code: string; path: string; type: string; title: string; description: string | null;
  status: "scheduled" | "live" | "ended"; starts_at: string | null; ends_at: string | null; ended_at: string | null;
  allow_preview: boolean; replies_enabled: boolean; reactions_enabled: boolean; posts_count: number; participants_count: number;
  created_at: string; realtime_key: string | null;
  host: { name: string | null; username: string | null; avatar: string | null } | null;
  community: { id: number; name: string; slug: string; avatar: string | null; members_count: number; join_policy: Policy; read_policy: string };
  viewer: {
    authenticated: boolean; is_member: boolean; can_view: boolean; can_post: boolean; can_reply: boolean; can_react: boolean;
    is_host: boolean; can_moderate: boolean; blocked: boolean; muted: boolean; join: Policy | null;
  };
}
export interface SessionPost {
  id: number; parent_id: number | null; alias: string; body: string; reactions_count: number; replies_count: number;
  created_at: string; is_mine: boolean; my_reaction: string | null;
}
export interface SessionReport {
  id: number; target_id: number; reason: string; details: string | null; status: string; created_at: string;
  preview: { alias: string; body: string; removed: boolean };
}

export interface Resource {
  id: number; post_id: number; title: string; description: string | null; doc_type: string; course_code: string | null;
  academic_session: string | null; subject: string | null; collection_id: number | null; created_at: string; in_feed: boolean;
  uploader: Person | null; file: { url: string | null; thumbnail: string | null; size: number | null; mime: string | null; name: string | null } | null;
}
export interface Collection { id: number; name: string; description: string | null; count?: number }
export interface LibraryPage {
  items: Resource[]; cursor: string | null; hasMore: boolean; collections?: Collection[];
  facets?: { course_codes: string[]; sessions: string[]; doc_types: string[] };
}

const C = (p: string) => `communities/${p}`;
const person = <T extends { avatar: string | null }>(p: T): T => ({ ...p, avatar: mediaUrl(p.avatar) });
const com = <T extends { avatar: string | null; cover: string | null }>(c: T): T => ({ ...c, avatar: mediaUrl(c.avatar), cover: mediaUrl(c.cover) });
const detail = (c: CommunityDetail): CommunityDetail => ({ ...com(c), staff: (c.staff ?? []).map(person), face_pile: (c.face_pile ?? []).map(person) });
const ok = { ok: true as boolean };

export const communitiesApi = {
  discover: async (p: { search?: string; category?: string | null; page?: number }) => {
    const r = await api.get<{ data: Community[]; has_more: boolean }>(C("discover"), p);
    return { items: r.data.map(com), hasMore: r.has_more };
  },
  mine: async () => (await api.get<{ data: MineRow[] }>(C("mine"))).data.map(com),
  show: async (ref: string) => detail((await api.get<{ community: CommunityDetail }>(C(`show/${encodeURIComponent(ref)}`))).community),
  feed: async (ref: string, cursor: string | null) => {
    const r = await api.get<{ posts: (Post & { community_pinned?: boolean })[]; next_cursor: string | null; has_more: boolean }>(
      C(`feed/${encodeURIComponent(ref)}`), { cursor });
    const posts: CPost[] = r.posts.map((p) => ({ ...normPost(p), community_pinned: p.community_pinned === true }));
    return { posts, cursor: r.next_cursor, hasMore: r.has_more };
  },
  create: async (body: Record<string, unknown>) => detail((await api.post<{ community: CommunityDetail }>(C("create"), body)).community),
  update: async (id: number, body: Record<string, unknown>) => detail((await api.post<{ community: CommunityDetail }>(C(`update/${id}`), body)).community),
  join: (id: number, message?: string) => api.post<JoinResult>(C(`join/${id}`), { message }),
  leave: (id: number) => api.post<{ is_member: boolean }>(C(`leave/${id}`)),

  requests: async (id: number) => (await api.get<{ data: JoinRequest[] }>(C(`requests/${id}`))).data.map((r) => ({ ...r, user: person(r.user) })),
  decide: (id: number, requestId: number, approve: boolean) => api.post<{ result: string }>(C(`decide/${id}`), { request_id: requestId, approve }),
  invites: async (id: number) => (await api.get<{ data: Invite[] }>(C(`invites/${id}`))).data,
  createInvite: async (id: number, body: { label?: string; max_uses?: number | null; expires_hours?: number | null }) =>
    (await api.post<{ invite: Invite }>(C(`invites/${id}`), body)).invite,
  revokeInvite: (id: number, inviteId: number) => api.post<typeof ok>(C(`invite-revoke/${id}`), { invite_id: inviteId }),
  invitePreview: async (token: string) => {
    const r = await api.get<InvitePreview>(C(`invite-preview/${encodeURIComponent(token)}`));
    return r.community ? { ...r, community: { ...r.community, avatar: mediaUrl(r.community.avatar) } } : r;
  },
  redeem: (token: string) => api.post<{ result: string; slug?: string }>(C(`invite-redeem/${encodeURIComponent(token)}`)),

  members: async (id: number, page: number) => {
    const r = await api.get<{ data: Member[]; has_more: boolean }>(C(`members/${id}`), { page });
    return { items: r.data.map(person), hasMore: r.has_more };
  },
  memberRole: (id: number, userId: number, role: Role) => api.post<{ role: string }>(C(`member-role/${id}`), { user_id: userId, role }),
  memberRemove: (id: number, userId: number) => api.post<typeof ok>(C(`member-remove/${id}`), { user_id: userId }),
  ban: (id: number, userId: number, reason?: string) => api.post<typeof ok>(C(`ban/${id}`), { user_id: userId, reason }),
  grantDesignation: (id: number, body: { user_id: number; kind: DesigKind; scope_label?: string; can_announce?: boolean }) =>
    api.post<{ designation: Desig }>(C(`designation/${id}`), body),
  revokeDesignation: (id: number, designationId: number) => api.post<typeof ok>(C(`designation-revoke/${id}`), { designation_id: designationId }),
  prefs: (id: number) => api.get<{ chat_notify: "all" | "mentions" | "none"; announce_notify: boolean }>(C(`prefs/${id}`)),
  setPrefs: (id: number, body: { chat_notify?: string; announce_notify?: boolean }) => api.post<typeof ok>(C(`prefs/${id}`), body),

  post: (id: number, body: Record<string, unknown>) => api.post<{ post_id: number }>(C(`post/${id}`), body),
  pin: (id: number, postId: number, pinned: boolean) => api.post<{ pinned: boolean }>(C(`pin/${id}`), { post_id: postId, pinned }),
  postRemove: (id: number, postId: number) => api.post<typeof ok>(C(`post-remove/${id}`), { post_id: postId }),
  report: (id: number, body: { kind: "post" | "comment" | "message" | "resource"; target_id: number; reason: string }) =>
    api.post<typeof ok>(C(`report/${id}`), body),
  reports: async (id: number) => (await api.get<{ data: Report[] }>(C(`reports/${id}`))).data,
  reportHandle: (id: number, reportId: number, action: "dismiss" | "remove") =>
    api.post<{ status: string }>(C(`report-handle/${id}`), { report_id: reportId, action }),

  library: async (id: number, p: { cursor?: string | null; q?: string; doc_type?: string | null; course_code?: string | null; collection_id?: number | null }): Promise<LibraryPage> => {
    const r = await api.get<{ data: Resource[]; next_cursor: string | null; has_more: boolean; collections?: Collection[]; facets?: LibraryPage["facets"] }>(C(`library/${id}`), p);
    return { items: r.data.map(normRes), cursor: r.next_cursor, hasMore: r.has_more, collections: r.collections, facets: r.facets };
  },
  libraryAdd: (id: number, body: Record<string, unknown>) => api.post<{ resource: Resource }>(C(`library-add/${id}`), body),
  libraryRemove: (id: number, resourceId: number) => api.post<typeof ok>(C(`library-remove/${id}`), { resource_id: resourceId }),
  collectionSave: (id: number, body: { name: string; description?: string; collection_id?: number }) =>
    api.post<{ collection: Collection }>(C(`collection-save/${id}`), body),
  collectionRemove: (id: number, collectionId: number) => api.post<typeof ok>(C(`collection-remove/${id}`), { collection_id: collectionId }),

  sessions: async (ref: string) => (await api.get<{ data: SessionCard[] }>(C(`sessions/${encodeURIComponent(ref)}`))).data,
  sessionCreate: async (id: number, body: Record<string, unknown>) => (await api.post<{ session: SessionInfo }>(C(`session-create/${id}`), body)).session,
  session: async (code: string) => normSession((await api.get<{ session: SessionInfo }>(C(`session/${encodeURIComponent(code)}`))).session),
  sessionFeed: (code: string, cursor: string | null) =>
    api.get<{ posts: SessionPost[]; next_cursor: string | null; has_more: boolean }>(C(`session-feed/${encodeURIComponent(code)}`), { cursor }),
  sessionReplies: async (code: string, postId: number) =>
    (await api.get<{ replies: SessionPost[] }>(C(`session-replies/${encodeURIComponent(code)}`), { post_id: postId })).replies,
  sessionPost: (code: string, body: { body: string; parent_id?: number }) => api.post<{ post: SessionPost }>(C(`session-post/${encodeURIComponent(code)}`), body),
  sessionReact: (code: string, postId: number, kind = "like") =>
    api.post<{ reactions_count: number; my_reaction: string | null }>(C(`session-react/${encodeURIComponent(code)}`), { post_id: postId, kind }),
  sessionEnd: (code: string) => api.post<{ status: string }>(C(`session-end/${encodeURIComponent(code)}`)),
  sessionRemove: (code: string, body: { post_id: number; reason?: string; block?: boolean }) => api.post<typeof ok>(C(`session-remove/${encodeURIComponent(code)}`), body),
  sessionReport: (code: string, body: { post_id: number; reason: string }) => api.post<typeof ok>(C(`session-report/${encodeURIComponent(code)}`), body),
  sessionReports: async (code: string) => (await api.get<{ data: SessionReport[] }>(C(`session-reports/${encodeURIComponent(code)}`))).data,
  sessionReportHandle: (code: string, body: { report_id: number; action: "dismiss" | "remove"; block?: boolean }) =>
    api.post<{ status: string }>(C(`session-report-handle/${encodeURIComponent(code)}`), body),
};

function normRes(r: Resource): Resource {
  return {
    ...r,
    uploader: r.uploader ? person(r.uploader) : null,
    file: r.file ? { ...r.file, url: mediaUrl(r.file.url), thumbnail: mediaUrl(r.file.thumbnail) } : null,
  };
}
function normSession(s: SessionInfo): SessionInfo {
  return { ...s, host: s.host ? person(s.host) : null, community: { ...s.community, avatar: mediaUrl(s.community.avatar) } };
}
