import { api } from "./client";
import { mediaUrl } from "./feed";
import { communitiesApi, type Community, type CommunityKind, type InvitePreview } from "./communities";

export type OnboardingSource = "direct" | "invite_desk" | "invite_community";
export type OnboardingStep = "profile" | "photo" | "campus" | "discovery";
export interface OnboardingEvent {
  kind: "start" | "step_done" | "step_skip" | "discovery_shown" | "complete" | "first_action";
  step?: OnboardingStep;
  source?: OnboardingSource;
  action?: string;
}

export interface OnboardingOptions {
  faculties: string[];
  departments: { name: string; faculty: string | null }[];
}
export type Suggestion = Community & { reason: string };

/** invite-preview already returns these; communitiesApi.invitePreview just doesn't type them. */
export type InvitePeek = InvitePreview & {
  kind?: CommunityKind;
  join_mode?: "join" | "request";
  eligible?: boolean | null;
  desk?: {
    course_code: string | null; course_title: string; semester: string | null; academic_session: string | null;
    level: string | null; department: string | null; lecturer_name: string | null; verified: boolean;
    institution: { name: string; short_name: string | null } | null; institution_only: boolean;
  } | null;
};

const space = (c: Suggestion): Suggestion => ({ ...c, avatar: mediaUrl(c.avatar), cover: mediaUrl(c.cover) });

export const onboardingApi = {
  options: (institutionId: number) =>
    api.get<OnboardingOptions>("communities/onboarding-options", { institution_id: institutionId }),

  picks: async () => {
    const r = await api.get<{ scope: Record<string, boolean>; communities: Suggestion[]; desks: Suggestion[] }>("communities/onboarding-picks");
    return { scope: r.scope, communities: (r.communities ?? []).map(space), desks: (r.desks ?? []).map(space) };
  },

  // profile-update is a patch; institution_id is always sent so the call is never empty.
  saveCampus: (b: { institution_id: number; faculty: string | null; department: string | null; level: string | null; campus_role: string }) =>
    api.patch("profile-update", b),

  // Fire and forget: analytics must never block or fail the flow.
  event: (e: OnboardingEvent) => {
    void api.post("communities/onboarding-event", e).catch(() => {});
  },

  invitePeek: (token: string) => communitiesApi.invitePreview(token) as unknown as Promise<InvitePeek>,
};
