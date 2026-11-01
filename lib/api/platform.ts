import { api, ApiError } from "./client";
import { mediaUrl } from "./feed";

export type AccountStatus = "provisioned" | "active" | "suspended";

export interface PlatformAccount {
  key: string;
  status: AccountStatus;
  created_at: string;
  activated_at: string | null;
  suspended_at: string | null;
  id: number;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  followers: number;
}

export interface AccountDetail extends PlatformAccount {
  tagline: string | null;
  can: { edit: boolean; status: boolean; admins: boolean };
}

export interface StaffLite {
  user_id: number;
  role: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
}
export interface AccountAdmin extends StaffLite {
  can_publish: boolean;
  can_manage: boolean;
}
export interface StaffMember extends StaffLite {
  created_at: string;
}
export interface AuditRow {
  id: number;
  actor_id: number | null;
  action: string;
  target_kind: string | null;
  target_id: number | null;
  detail: Record<string, unknown>;
  created_at: string;
  actor: { id: number; name: string | null; username: string | null } | null;
}

export const STAFF_ROLES = ["super_admin", "comms_admin", "editor", "moderator", "analyst"] as const;
export const roleLabel = (r: string) => r.replace("_", " ");

/** Field-level validation text when the server sent it, else the general message. */
export function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const first = e.errors ? Object.values(e.errors).find((v) => typeof v === "string") : null;
    return (first as string | undefined) ?? e.message;
  }
  return "Something went wrong.";
}

const withAvatar = <T extends { avatar: string | null }>(x: T): T => ({ ...x, avatar: mediaUrl(x.avatar) });
const base = (key: string) => `platform/accounts/${encodeURIComponent(key)}`;

export const platformApi = {
  accounts: async (signal?: AbortSignal): Promise<PlatformAccount[]> =>
    ((await api.get<{ data?: PlatformAccount[] }>("platform/accounts", undefined, signal)).data ?? []).map(withAvatar),

  account: async (key: string, signal?: AbortSignal): Promise<AccountDetail> =>
    withAvatar(await api.get<AccountDetail>(base(key), undefined, signal)),
  updateAccount: (key: string, body: { name?: string; bio?: string; tagline?: string }) =>
    api.patch<AccountDetail>(base(key), body),
  setStatus: (key: string, action: "activate" | "suspend" | "recover") =>
    api.post<AccountDetail>(`${base(key)}/status`, { action }),

  admins: async (key: string): Promise<{ data: AccountAdmin[]; candidates: StaffLite[] }> => {
    const r = await api.get<{ data?: AccountAdmin[]; candidates?: StaffLite[] }>(`${base(key)}/admins`);
    return { data: (r.data ?? []).map(withAvatar), candidates: (r.candidates ?? []).map(withAvatar) };
  },
  setAdmin: (key: string, body: { staff_user_id: number; can_publish?: boolean; can_manage?: boolean }) =>
    api.post(`${base(key)}/admins`, body),
  removeAdmin: (key: string, staff_user_id: number) => api.delete(`${base(key)}/admins`, { staff_user_id }),

  staff: async (): Promise<StaffMember[]> =>
    ((await api.get<{ data?: StaffMember[] }>("platform/staff")).data ?? []).map(withAvatar),
  grantStaff: (body: { username: string; role: string }) => api.post("platform/staff", body),
  setStaffRole: (id: number, role: string) => api.patch(`platform/staff/${id}`, { role }),
  revokeStaff: (id: number) => api.delete(`platform/staff/${id}`),

  audit: (cursor?: string | null) =>
    api.get<{ data: AuditRow[]; next_cursor: string | null }>("platform/audit", { cursor }),
};
