import { api } from "./client";

export type SkillStance = "learning" | "practising" | "offering" | "want_to_learn";
export type Visibility = "public" | "campus" | "private";
export type OfferKind = "service" | "product" | "project" | "teach" | "collaborate" | "business";
export type OnboardingStage = "welcome" | "intent" | "interests" | "skills" | "goals" | "offers" | "campus" | "profile" | "reveal";

export interface TaxInterest { id: number; slug: string; label: string; group_key: string }
export interface TaxSkill { id: number; slug: string; label: string; category: string }
export interface TaxSeek { id: number; slug: string; label: string }
export interface MySkill { skill_id: number; label: string; stance: SkillStance; visibility: Visibility }
export interface MyOffer { id: number; kind: OfferKind; title: string; description: string | null; skill_id: number | null; visibility: Visibility }
export interface Availability { status: "open" | "limited" | "closed"; modes: ("remote" | "on_campus" | "in_person")[]; note: string | null }

export interface PersonalizationState {
  taxonomy: { interests: TaxInterest[]; skills: TaxSkill[]; seek_kinds: TaxSeek[] };
  profile: {
    personalization_enabled: boolean;
    /** A flag for the client. Existing users are never forced through onboarding. */
    completed: boolean;
    stage_done: OnboardingStage[]; stage_skipped: OnboardingStage[];
    interests: number[]; seeking: number[]; skills: MySkill[]; offers: MyOffer[]; availability: Availability | null;
  };
}

/** Send only the sections that changed: a section that is present replaces the stored one, an absent one is left alone. */
export interface PersonalizationSave {
  interests?: number[];
  seeking?: number[];
  skills?: { skill_id?: number; label?: string; stance: SkillStance; visibility?: Visibility }[];
  offers?: { id?: number; kind: OfferKind; title: string; description?: string; skill_id?: number; visibility?: Visibility }[];
  availability?: Availability;
  personalization_enabled?: boolean;
  stage_done?: OnboardingStage[];
  stage_skipped?: OnboardingStage[];
  complete?: boolean;
}

export const personalizationApi = {
  get: () => api.get<PersonalizationState>("users/personalization"),
  save: (body: PersonalizationSave) => api.patch<PersonalizationState>("users/personalization", body),
};
