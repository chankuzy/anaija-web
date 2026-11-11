import { api } from "./client";
import { mediaUrl, normPost } from "./feed";
import type { Post } from "./feed-types";

export type Role = "owner" | "admin" | "moderator" | "member";
export type DesigKind = "class_rep" | "course_rep" | "dept_exec" | "contributor";
export type Policy = "open" | "request" | "invite";
export interface Desig { id?: number; kind: DesigKind; scope_label: string | null }

export type CommunityKind = "community" | "course_desk";
export interface Community {
  id: number; name: string; slug: string; description: string | null; avatar: string | null; cover: string | null;
  category: string; institution_id: number | null; faculty: string | null; department: string | null; level: string | null;
  course_code: string | null; academic_session: string | null; members_count: number; posts_count: number;
  discoverability: "listed" | "unlisted"; join_policy: Policy; read_policy: "public_preview" | "members_only";
  status: string; is_member: boolean; my_role: Role | null; request_status: "pending" | null;
  /** Absent on payloads cached before Course Desks shipped: treat as "community". */
  kind?: CommunityKind;
  /** Course Desks only. */
  course_title?: string | null; verified?: boolean; institution_only?: boolean;
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
export interface JoinResult { status?: string; state?: string; is_member?: boolean; request_status?: string | null; members_count?: number }

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
  /** Absent on payloads cached before versions shipped: treat as 1. */
  version?: number; updated_at?: string | null; replaced_at?: string | null;
  uploader: Person | null; file: { url: string | null; thumbnail: string | null; size: number | null; mime: string | null; name: string | null } | null;
}
export interface ResourceVersion {
  version: number; post_id: number; is_current: boolean; note: string | null; restored_from: number | null; created_at: string;
  available: boolean; uploader: Person | null;
  file: { url: string | null; thumbnail: string | null; size: number | null; mime: string | null; name: string | null } | null;
}
export interface Collection { id: number; name: string; description: string | null; count?: number }
export interface LibraryPage {
  items: Resource[]; cursor: string | null; hasMore: boolean; collections?: Collection[];
  facets?: { course_codes: string[]; sessions: string[]; doc_types: string[] };
}

// ── Course Desks ───────────────────────────────────────────────────────────
export type DeskAccess = "open" | "restricted" | "institutional";
export type Semester = "first" | "second" | "summer";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export interface DeskInfo {
  course_title: string; semester: Semester | null; lecturer_name: string | null; institution_only: boolean; access: DeskAccess;
  verification_status: VerificationStatus; verified: boolean; verified_at: string | null;
  /** Only the owner receives the admin's note. */
  verification_note?: string | null;
}
export interface DeskLeader extends Person { role: Role; lecturer: boolean; assistant: boolean }
export interface DeskNotice {
  id: number; title: string; priority: "important" | "normal"; pinned: boolean; created_at: string;
  event_at: string | null; deadline_at: string | null;
}
export interface DeskMaterial {
  id: number; post_id: number; title: string; doc_type: string; course_code: string | null; created_at: string;
  uploader: { name: string | null; username: string | null } | null;
}

export type EventKind = "lecture" | "extra_class" | "test" | "revision" | "deadline" | "other";
/** Minutes before the event. The server accepts only these four. */
export const REMINDER_OPTIONS = [60, 180, 1440, 4320] as const;
export interface DeskEvent {
  id: number; kind: EventKind; title: string; description: string | null;
  starts_at: string; ends_at: string | null; venue: string | null; meeting_url: string | null;
  status: "scheduled" | "cancelled"; cancel_reason: string | null; cancelled_at: string | null;
  change_kind: "rescheduled" | "updated" | null; previous_starts_at: string | null; changed_at: string | null;
  remind_minutes: number[]; version: number; can_edit: boolean;
}
/** The overview's upcoming rows keep `event_at` (= starts_at) for older readers. */
export type DeskUpcoming = DeskEvent & { event_at: string };
export interface EventInput {
  kind: EventKind; title: string; description?: string | null; starts_at: string; ends_at?: string | null;
  venue?: string | null; meeting_url?: string | null; remind_minutes?: number[];
}
export interface DeskPerms { schedule: boolean; materials: boolean; coordinate: boolean; announce: boolean; insights: boolean; grant: boolean }
export type DeskPerm = "announce" | "schedule" | "materials" | "coordinate";
export interface DeskTeamRow {
  id: number; kind: string; scope_label: string | null; permissions: DeskPerm[]; user: Person;
}

export interface DeskOverview {
  identity: {
    id: number; name: string; slug: string; description: string | null; avatar: string | null; cover: string | null;
    course_code: string | null; academic_session: string | null; faculty: string | null; department: string | null; level: string | null;
    institution: { name: string; short_name: string | null } | null; members_count: number;
  };
  desk: DeskInfo; can: Can; perms: DeskPerms; is_member: boolean; my_role: Role | null; request_status: "pending" | null;
  leaders: DeskLeader[]; announcements: DeskNotice[]; upcoming: DeskUpcoming[]; materials: DeskMaterial[];
}
export interface RelatedSpace extends Community { reason: string }
export interface DeskStats {
  members: number; invite_views: number; joins: number; joins_via_invite: number; new_accounts: number;
  first_actions: number; activation_rate: number | null; material_opens_7d: number;
}
/** Counted from real rows by desk_insights(). "opens" are tracked views, "users" are distinct students. */
export interface DeskInsights {
  period_days: number; students: number; staff: number; active_students: number; tracking_started: string | null;
  material: {
    opens: number; unique_users: number;
    series: { day: string; opens: number; users: number }[];
    top: { resource_id: number; title: string; opens: number; users: number }[];
  };
  announcements: { post_id: number; title: string | null; created_at: string; unique_opens: number; total_opens: number }[];
  discussions: {
    questions_total: number; questions_period: number; resolved: number; unanswered: number;
    responses_total: number; responses_period: number; responders_period: number;
  };
  polls: { items: { post_id: number; question: string | null; voters: number; participation: number | null }[]; avg_participation: number | null };
}
export interface CommunityPrefs { chat_notify: "all" | "mentions" | "none"; announce_notify: boolean; discussion_notify: boolean }

const C = (p: string) => `communities/${p}`;
const person = <T extends { avatar: string | null }>(p: T): T => ({ ...p, avatar: mediaUrl(p.avatar) });
const com = <T extends { avatar: string | null; cover: string | null }>(c: T): T => ({ ...c, avatar: mediaUrl(c.avatar), cover: mediaUrl(c.cover) });
const detail = (c: CommunityDetail): CommunityDetail => ({ ...com(c), staff: (c.staff ?? []).map(person), face_pile: (c.face_pile ?? []).map(person) });
const ok = { ok: true as boolean };
const eventFile = <T extends { url: string | null; thumbnail: string | null }>(f: T | null): T | null =>
  f ? { ...f, url: mediaUrl(f.url), thumbnail: mediaUrl(f.thumbnail) } : null;

export const communitiesApi = {
  discover: async (p: { search?: string; category?: string | null; page?: number }) => {
    const r = await api.get<{ data: Community[]; has_more: boolean }>(C("discover"), p);
    return { items: r.data.map(com), hasMore: r.has_more };
  },
  mine: async () => (await api.get<{ data: MineRow[] }>(C("mine"))).data.map(com),
  show: async (ref: string) => detail((await api.get<{ community: CommunityDetail }>(C(`show/${encodeURIComponent(ref)}`))).community),
  /** `subtype` filters the feed: "announcement" | "question" | ... (the server ignores unknown values). */
  feed: async (ref: string, cursor: string | null, subtype?: string | null) => {
    const r = await api.get<{ posts: (Post & { community_pinned?: boolean })[]; next_cursor: string | null; has_more: boolean }>(
      C(`feed/${encodeURIComponent(ref)}`), { cursor, ...(subtype ? { subtype } : {}) });
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
  prefs: (id: number) => api.get<Partial<CommunityPrefs> & Pick<CommunityPrefs, "chat_notify" | "announce_notify">>(C(`prefs/${id}`))
    .then((r): CommunityPrefs => ({ ...r, discussion_notify: r.discussion_notify ?? false })),
  setPrefs: (id: number, body: { chat_notify?: string; announce_notify?: boolean; discussion_notify?: boolean }) => api.post<typeof ok>(C(`prefs/${id}`), body),

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
  /** The new file must already be published as a document post by the same user (communities/post with library.replace). */
  libraryReplace: async (id: number, body: { resource_id: number; post_id: number; note?: string; notify?: boolean }) => {
    const r = await api.post<{ resource: Resource | null; version: number; notified: boolean }>(C(`library-replace/${id}`), body);
    return { ...r, resource: r.resource ? normRes(r.resource) : null };
  },
  libraryVersions: async (id: number, resourceId: number) => {
    const r = await api.get<{ current_version: number; can_restore: boolean; data: ResourceVersion[] }>(C(`library-versions/${id}/${resourceId}`));
    return {
      ...r,
      data: r.data.map((v) => ({ ...v, uploader: v.uploader ? person(v.uploader) : null, file: eventFile(v.file) })),
    };
  },
  libraryRestore: (id: number, resourceId: number, version: number) =>
    api.post<{ resource: Resource | null; version: number }>(C(`library-restore/${id}`), { resource_id: resourceId, version }),
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

  // ── Course Desks ─────────────────────────────────────────────────────────
  deskCreate: async (body: Record<string, unknown>) => {
    const r = await api.post<{ community: CommunityDetail; desk: DeskInfo | null; similar: number }>(C("desk-create"), body);
    return { ...r, community: detail(r.community) };
  },
  deskUpdate: async (id: number, body: Record<string, unknown>) => {
    const r = await api.post<{ community: CommunityDetail; desk: DeskInfo }>(C(`desk-update/${id}`), body);
    return { ...r, community: detail(r.community) };
  },
  deskOverview: async (ref: string): Promise<DeskOverview> => {
    const r = await api.get<DeskOverview>(C(`desk/${encodeURIComponent(ref)}`));
    return { ...r, identity: { ...r.identity, avatar: mediaUrl(r.identity.avatar), cover: mediaUrl(r.identity.cover) }, leaders: (r.leaders ?? []).map(person) };
  },
  deskVerify: (id: number, body: { lecturer_name: string; note: string }) =>
    api.post<{ verification_status: VerificationStatus }>(C(`desk-verify/${id}`), body),
  deskAssistant: (id: number, body: { user_id: number; assistant: boolean; can_announce?: boolean; permissions?: DeskPerm[] }) =>
    api.post<{ ok: boolean; assistant: boolean; permissions?: DeskPerm[] }>(C(`desk-assistant/${id}`), body),
  /** Owner, admin or lecturer: set what a designation holder may do. */
  deskPermissions: (id: number, designationId: number, permissions: DeskPerm[]) =>
    api.post<{ ok: boolean; permissions: DeskPerm[] }>(C(`desk-permissions/${id}`), { designation_id: designationId, permissions }),
  deskTeam: async (id: number) =>
    (await api.get<{ data: DeskTeamRow[] }>(C(`desk-team/${id}`))).data.map((r) => ({ ...r, user: person(r.user) })),
  deskTrack: (id: number, resourceId: number) => api.post<typeof ok>(C(`desk-track/${id}`), { kind: "material_open", resource_id: resourceId }),
  deskTrackOpen: (id: number) => api.post<typeof ok>(C(`desk-track/${id}`), { kind: "desk_open" }),
  deskTrackAnnouncement: (id: number, postId: number) =>
    api.post<typeof ok>(C(`desk-track/${id}`), { kind: "announcement_open", post_id: postId }),
  deskStats: (id: number) => api.get<DeskStats>(C(`desk-stats/${id}`)),
  deskInsights: (id: number, days = 7) => api.get<DeskInsights>(C(`desk-insights/${id}`), { days }),

  // Schedule. Times are ISO strings (UTC on the wire); the UI shows Africa/Lagos.
  deskEvents: (id: number) => api.get<{ data: DeskEvent[]; has_more: boolean; can_edit: boolean }>(C(`desk-events/${id}`)),
  deskPastEvents: (id: number, before?: string | null) =>
    api.get<{ data: DeskEvent[]; has_more: boolean; can_edit: boolean }>(C(`desk-events/${id}`), { range: "past", ...(before ? { before } : {}) }),
  deskEventCreate: async (id: number, body: EventInput) => (await api.post<{ event: DeskEvent }>(C(`desk-event-create/${id}`), body)).event,
  /** `expected_version` makes a concurrent edit a 409 instead of a silent overwrite. */
  deskEventUpdate: (id: number, eventId: number, body: Partial<EventInput> & { expected_version?: number }) =>
    api.post<{ event: DeskEvent; changed: boolean }>(C(`desk-event-update/${id}`), { event_id: eventId, ...body }),
  deskEventCancel: async (id: number, eventId: number, reason?: string) =>
    (await api.post<{ event: DeskEvent }>(C(`desk-event-cancel/${id}`), { event_id: eventId, reason })).event,

  related: async (id: number) => {
    const r = await api.get<{ communities: RelatedSpace[]; desks: RelatedSpace[] }>(C(`related/${id}`));
    return { communities: (r.communities ?? []).map(com), desks: (r.desks ?? []).map(com) };
  },
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
