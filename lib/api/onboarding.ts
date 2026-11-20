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
  /** true: the institution has a curated structure and the lists are closed. false: names seen on communities, free text allowed. */
  curated: boolean;
  faculties: string[];
  departments: { name: string; faculty: string | null }[];
}
export type Suggestion = Community & { reason: string };

/** A person or official account to follow. `label` is the strongest thing proven about them ("Your department", "Official", "On Anaija"). */
export interface Person {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_verified: boolean;
  label: string;
}

export interface Picks {
  scope: Record<string, boolean>;
  /** Listed Anaija-owned communities (HQ, Commons, ...). */
  platform: Suggestion[];
  /** Active official accounts. */
  accounts: Person[];
  /** Campus-matched communities and verified Course Desks. */
  communities: Suggestion[];
  desks: Suggestion[];
  /** Public communities that top up a thin campus list. */
  popular: Suggestion[];
  /** People to follow, closest first. */
  people: Person[];
}

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
const person = (p: Person): Person => ({ ...p, avatar: mediaUrl(p.avatar) });

export const onboardingApi = {
  options: async (institutionId: number): Promise<OnboardingOptions> => {
    const r = await api.get<Partial<OnboardingOptions>>("communities/onboarding-options", { institution_id: institutionId });
    return { curated: r.curated === true, faculties: r.faculties ?? [], departments: r.departments ?? [] };
  },

  picks: async (): Promise<Picks> => {
    const r = await api.get<Partial<Picks>>("communities/onboarding-picks");
    return {
      scope: r.scope ?? {},
      platform: (r.platform ?? []).map(space),
      accounts: (r.accounts ?? []).map(person),
      communities: (r.communities ?? []).map(space),
      desks: (r.desks ?? []).map(space),
      popular: (r.popular ?? []).map(space),
      people: (r.people ?? []).map(person),
    };
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
