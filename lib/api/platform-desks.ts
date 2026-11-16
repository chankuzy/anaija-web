import { api } from "./client";
import { mediaUrl } from "./feed";

export type DeskVerification = "pending" | "unverified" | "verified" | "rejected";
export type DeskQueue = DeskVerification | "all";
export const QUEUES: [DeskQueue, string][] = [
  ["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"], ["all", "All"],
];

export interface DeskPerson { id: number; name: string | null; username: string | null; avatar: string | null }
export interface PlatformDesk {
  id: number; name: string; slug: string; course_code: string | null; course_title: string;
  academic_session: string | null; department: string | null; level: string | null; institution_id: number | null;
  members: number; listed: boolean; community_status: string; access: string | null; lecturer_name: string | null;
  verification_status: DeskVerification; verification_requested_at: string | null; verification_note: string | null;
  verified_at: string | null; created_at: string; owner: DeskPerson | null; duplicates: number;
}
export interface PlatformDeskDetail extends PlatformDesk {
  institution: { name: string; short_name: string | null } | null;
  lecturer: DeskPerson | null;
  duplicate_desks: { id: number; name: string; slug: string; members: number; status: string; owner: DeskPerson | null }[];
}
export interface DeskPage { data: PlatformDesk[]; next_cursor: string | null }

const person = (p: DeskPerson | null): DeskPerson | null => (p ? { ...p, avatar: mediaUrl(p.avatar) } : null);

export const platformDesksApi = {
  list: async (status: DeskQueue, cursor?: string | null): Promise<DeskPage> => {
    const r = await api.get<DeskPage>("platform/desks", { status, ...(cursor ? { cursor } : {}) });
    return { data: (r.data ?? []).map((d) => ({ ...d, owner: person(d.owner) })), next_cursor: r.next_cursor ?? null };
  },
  get: async (id: number): Promise<PlatformDeskDetail> => {
    const r = await api.get<PlatformDeskDetail>(`platform/desks/${id}`);
    return {
      ...r, owner: person(r.owner), lecturer: person(r.lecturer),
      duplicate_desks: (r.duplicate_desks ?? []).map((d) => ({ ...d, owner: person(d.owner) })),
    };
  },
  /** `note` is required: how the lecturer was confirmed (verified) or why not (rejected, revoked). */
  verify: (id: number, body: { status: "verified" | "rejected" | "unverified"; note: string; lecturer_username?: string; lecturer_name?: string }) =>
    api.post<{ verification_status: DeskVerification }>(`platform/desks/${id}/verify`, body),
};
