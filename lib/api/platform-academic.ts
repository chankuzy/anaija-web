import { api } from "./client";

export type UnitVerification = "verified" | "unverified" | "conflicting";
export interface AcademicUnit {
  id: number; parent_id: number | null; kind: "faculty" | "department" | "unit"; name: string; aliases: string[]; sort_order: number;
  is_active: boolean; source_url: string | null; verification: UnitVerification; last_verified_at: string | null; note: string | null;
  community: { id: number; slug: string; academic_unit_id: number; discoverability: "listed" | "unlisted"; members_count: number } | null;
  open_discrepancies: number;
}
export interface AcademicProgramme { id: number; unit_id: number | null; tier: string; award: string; name: string; is_active: boolean; verification: UnitVerification }
export interface Discrepancy {
  id: number; institution_id: number | null; entity_kind: string; entity_id: number | null; kind: string; summary: string;
  sources: string[]; status: "open" | "resolved" | "dismissed"; resolution: string | null; created_at: string;
}
export interface AcademicOverview { units: AcademicUnit[]; programmes: AcademicProgramme[]; open_total: number }
export interface ProvisionResult { created: { community_id: number; unit_id: number; kind: string; slug: string }[]; unlisted_discontinued: number }

export const platformAcademicApi = {
  overview: (institutionId: number) => api.get<AcademicOverview>("platform/academic-units", { institution_id: institutionId }),
  editUnit: (id: number, body: { verification?: UnitVerification; note?: string; is_active?: boolean; name?: string }) =>
    api.patch<AcademicUnit>(`platform/academic-units/${id}`, body),
  setListing: (id: number, listed: boolean) => api.post<{ id: number; slug: string; discoverability: string }>(`platform/academic-units/${id}/listing`, { listed }),
  discrepancies: (institutionId: number) =>
    api.get<{ data: Discrepancy[]; next_cursor: string | null }>("platform/academic-discrepancies", { status: "open", institution_id: institutionId }),
  closeDiscrepancy: (id: number, status: "resolved" | "dismissed", resolution: string) =>
    api.post<Discrepancy>(`platform/academic-discrepancies/${id}`, { status, resolution }),
  provision: (institutionId: number, accountKey = "anaija") =>
    api.post<ProvisionResult>("platform/academic-provision", { institution_id: institutionId, account_key: accountKey }),
};
