import type { Insights } from "@/lib/api/community-insights";

// Presentation-side derivations. Nothing here invents data: it only phrases and compares what the server counted.
export const fmt = (n: number) => n.toLocaleString("en-NG");
export const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
export const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((100 * n) / d) : null);

export const TYPE_LABEL: Record<string, string> = {
  announcement: "Announcement", poll: "Poll", document: "Resource", article: "Editorial", question: "Question", post: "Post",
};
export const TYPE_PLURAL: Record<string, string> = {
  announcement: "Announcements", poll: "Polls", document: "Resources", article: "Editorials", question: "Questions", post: "Posts",
};

/** Returning members as a share of last period's active members. null when there is nothing honest to compare. */
export function retentionRate(i: Insights): number | null {
  const a = i.activity;
  return i.history_complete && a.prev_active > 0 ? Math.round((100 * a.returning) / a.prev_active) : null;
}

export function headline(i: Insights): string {
  const a = i.activity;
  const base = i.base_members;
  if (base === 0) return "Your community is ready for its first members.";
  if (a.active === 0) return `${plural(base, "member", "members")} so far. No one has taken part in the last 30 days.`;
  const joined = i.new_members > 0 ? ` ${plural(i.new_members, "member", "members")} joined this month.` : "";
  return `${fmt(a.active)} of ${fmt(base)} members took part in the last 30 days.${joined}`;
}

/** Plain-language suggestions, each backed by a number that is on screen elsewhere. */
export function focusNotes(i: Insights): string[] {
  const a = i.activity;
  const out: string[] = [];
  const rate = retentionRate(i);
  if (rate !== null && rate < 40) {
    out.push(`Fewer than 4 in 10 of last month's active members came back (${rate}%). A pinned announcement or a weekly poll gives them a reason to return.`);
  }
  if (i.base_members >= 10 && (pct(a.active, i.base_members) ?? 0) < 10) {
    out.push("Most members haven't taken part this month. A question or a poll is the easiest way to start a conversation.");
  }
  if (i.content.total < 4) {
    out.push(i.content.total === 0 ? "Nothing has been published this month." : `Only ${plural(i.content.total, "post", "posts")} this month. Regular posts give members something to respond to.`);
  }
  if (i.health.open_reports > 0) {
    out.push(`${plural(i.health.open_reports, "report is", "reports are")} waiting for review in Manage.`);
  }
  const best = i.by_type
    .filter((t) => t.posts > 0)
    .map((t) => ({ ...t, avg: t.interactors / t.posts }))
    .sort((x, y) => y.avg - x.avg)[0];
  if (best && best.avg > 0 && i.by_type.filter((t) => t.posts > 0).length > 1) {
    out.push(`${TYPE_PLURAL[best.type] ?? "Posts"} are drawing the most response: about ${Math.round(best.avg * 10) / 10} members per post.`);
  }
  return out.slice(0, 3);
}

// ── Milestones: goals on a fixed ladder, measured against real counts ──────────────────────────────────
export interface Milestone { id: string; label: string; caption: string; value: number; target: number; unit: "" | "%" }
const LADDERS = {
  active: [5, 10, 25, 50, 100, 250, 500, 1000],
  growth: [5, 10, 25, 50, 100, 250],
  contributions: [25, 50, 100, 250, 500, 1000, 2500],
  share: [10, 25, 50, 75, 100],
};
const nextTarget = (v: number, ladder: number[]) => ladder.find((t) => t > v) ?? ladder[ladder.length - 1];

export function milestonesFor(i: Insights): Milestone[] {
  const a = i.activity;
  const share = pct(a.active, i.base_members) ?? 0;
  const mk = (id: string, label: string, caption: string, value: number, ladder: number[], unit: "" | "%" = ""): Milestone =>
    ({ id, label, caption, value, target: nextTarget(value, ladder), unit });
  return [
    mk("active", "Active members", "Taking part each month", a.active, LADDERS.active),
    mk("growth", "New members", "Joined this month", i.new_members, LADDERS.growth),
    mk("contributions", "Contributions", "Posts, replies, votes, chats", a.contributions, LADDERS.contributions),
    mk("participation", "Participation", "Share of members taking part", share, LADDERS.share, "%"),
  ];
}
