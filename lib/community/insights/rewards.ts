import type { Insights } from "@/lib/api/community-insights";
import { pct, retentionRate } from "./model";

// Anaija Community Rewards: qualification logic, kept apart from the analytics UI so the programme can evolve
// without touching any screen. Rules this module must keep:
//  - no fixed payment per member, and nothing computed from sign-ups alone
//  - no balances, no "earned" language, no disbursement: it only describes eligibility signals
//  - while the programme is not operational, it is presented as upcoming
export type ProgrammeStatus = "upcoming" | "pilot" | "open";
export const PROGRAMME_STATUS: ProgrammeStatus = "upcoming";

export const PROGRAMME_COPY: Record<ProgrammeStatus, { badge: string; body: string; recognition: string }> = {
  upcoming: {
    badge: "Coming soon",
    body: "Anaija plans to recognise Community Leaders who build active, healthy communities. The programme hasn't opened yet, so nothing here has been earned or is payable. The criteria below are the signals we expect to use. Final requirements will be confirmed when the programme opens.",
    recognition: "Not available yet",
  },
  pilot: {
    badge: "Pilot",
    body: "The Community Rewards pilot is running with selected communities. Eligibility is reviewed by Anaija, and nothing here is automatic.",
    recognition: "Reviewed by Anaija",
  },
  open: {
    badge: "Open",
    body: "Community Rewards is open. Eligibility is reviewed by Anaija, and nothing here is automatic.",
    recognition: "Reviewed by Anaija",
  },
};

/** Proposed, adjustable. Not published requirements. */
export const THRESHOLDS = { minActive: 5, activeShare: 25, retention: 40, activeWeeks: 6, minContent: 4, maxOpenReports: 2 };

export type CriterionState = "in_range" | "building" | "no_data";
export interface Criterion { id: string; label: string; need: string; now: string; state: CriterionState }

export function evaluateCriteria(i: Insights, t = THRESHOLDS): Criterion[] {
  const a = i.activity;
  const share = pct(a.active, i.base_members);
  const rate = retentionRate(i);
  const last8 = a.weeks.filter((w) => w.w <= 7);
  const activeWeeks = last8.filter((w) => w.acts > 0).length;
  const ageDays = (Date.parse(i.generated_at) - Date.parse(i.community_created_at)) / 86_400_000;

  return [
    {
      id: "active", label: "Members taking part", need: `At least ${t.activeShare}% of members active, and ${t.minActive}+ people`,
      now: share === null ? "No members yet" : `${share}% · ${a.active} active`,
      state: share === null ? "no_data" : a.active >= t.minActive && share >= t.activeShare ? "in_range" : "building",
    },
    {
      id: "retention", label: "Members coming back", need: `At least ${t.retention}% of last month's active members return`,
      now: rate === null ? "Needs 60 days of history" : `${rate}% returned`,
      state: rate === null ? "no_data" : rate >= t.retention ? "in_range" : "building",
    },
    {
      id: "consistency", label: "Steady activity", need: `Activity in at least ${t.activeWeeks} of the last 8 weeks`,
      now: `${activeWeeks} of 8 weeks`,
      state: activeWeeks >= t.activeWeeks ? "in_range" : ageDays < 56 ? "no_data" : "building",
    },
    {
      id: "publishing", label: "Regular content", need: `At least ${t.minContent} posts in 30 days`,
      now: `${i.content.total} this month`,
      state: i.content.total >= t.minContent ? "in_range" : "building",
    },
    {
      id: "health", label: "Healthy community", need: `No more than ${t.maxOpenReports} open reports`,
      now: `${i.health.open_reports} open`,
      state: i.health.open_reports <= t.maxOpenReports ? "in_range" : "building",
    },
  ];
}

export const summarize = (cs: Criterion[]) => ({ inRange: cs.filter((c) => c.state === "in_range").length, total: cs.length });
