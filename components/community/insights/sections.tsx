"use client";

import { Icon } from "@/components/ui/icon";
import type { Insights } from "@/lib/api/community-insights";
import {
  TYPE_PLURAL, fmt, focusNotes, headline, milestonesFor, pct, plural, retentionRate,
} from "@/lib/community/insights/model";
import { PROGRAMME_COPY, PROGRAMME_STATUS, evaluateCriteria, summarize } from "@/lib/community/insights/rewards";
import { Ring } from "./ring";
import { Bar, Bars, Delta, Heading, Metric, Note, Row, Surface } from "./ui";

export type SectionId = "overview" | "growth" | "engagement" | "content" | "retention" | "rewards";

function Milestones({ i, size = 104 }: { i: Insights; size?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6">
      {milestonesFor(i).map((m) => (
        <div key={m.id} className="flex flex-col items-center text-center">
          <Ring value={m.value} target={m.target} size={size}>
            <span>
              <span className="block text-[22px] font-extrabold leading-none tabular-nums text-fg">{fmt(m.value)}{m.unit}</span>
              <span className="mt-1 block text-micro text-muted">of {fmt(m.target)}{m.unit}</span>
            </span>
          </Ring>
          <p className="mt-2.5 text-[14px] font-bold text-fg">{m.label}</p>
          <p className="mt-0.5 max-w-[150px] text-supporting leading-[1.35] text-muted">{m.caption}</p>
        </div>
      ))}
    </div>
  );
}

export function Overview({ i }: { i: Insights }) {
  const a = i.activity;
  const cmp = i.history_complete;
  const share = pct(a.active, i.base_members);
  const rate = retentionRate(i);
  const growth = cmp && i.new_members_prev > 0 ? Math.round((100 * (i.new_members - i.new_members_prev)) / i.new_members_prev) : null;
  const notes = focusNotes(i);
  return (
    <div className="space-y-6">
      <div className="px-1">
        <p className="text-[20px] font-extrabold leading-[1.25] tracking-tight text-fg">{headline(i)}</p>
        <p className="mt-1.5 text-secondary leading-[1.5] text-muted">
          Active means a member posted, replied, voted or chatted. Likes and opening the app don&apos;t count.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Metric label="Members" value={fmt(i.members)} sub="Including you" />
        <Metric label="Active this month" value={fmt(a.active)} sub={share === null ? "No members yet" : `${share}% of members`} />
        <Metric label="New this month" value={fmt(i.new_members)} sub={<Delta cur={i.new_members} prev={i.new_members_prev} enabled={cmp} />} />
        <Metric
          label="Returning"
          value={fmt(a.returning)}
          sub={rate === null ? "Needs 60 days of history" : `${rate}% of last month's ${fmt(a.prev_active)} active`}
        />
        <Metric label="Contributions" value={fmt(a.contributions)} sub={<Delta cur={a.contributions} prev={a.contributions_prev} enabled={cmp} />} />
        <Metric
          label="Growth"
          value={growth === null ? "—" : `${growth > 0 ? "+" : ""}${growth}%`}
          sub={growth === null ? "New members vs last month" : "New members vs last month"}
        />
      </div>

      <div>
        <Heading title="Milestones" hint="Your next goals" />
        <Surface><Milestones i={i} /></Surface>
      </div>

      <div>
        <Heading title="What needs attention" />
        <Surface className="py-1">
          {notes.length === 0 ? (
            <p className="py-3 text-secondary leading-[1.5] text-muted">Nothing needs attention right now. Keep doing what&apos;s working.</p>
          ) : (
            <ul className="divide-y divide-line">
              {notes.map((n, k) => <li key={k} className="py-3 text-secondary leading-[1.55] text-fg/90">{n}</li>)}
            </ul>
          )}
        </Surface>
      </div>
      <Note>
        Counted from real activity. Members who left aren&apos;t kept in history, so past membership sizes aren&apos;t reconstructed.
      </Note>
    </div>
  );
}

export function Growth({ i }: { i: Insights }) {
  const a = i.activity;
  const base = i.base_members;
  const cmp = i.history_complete;
  const activePct = pct(a.active, base) ?? 0;
  const rate = cmp && i.new_members_prev > 0 ? Math.round((100 * (i.new_members - i.new_members_prev)) / i.new_members_prev) : null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5">
        <Metric label="New this month" value={fmt(i.new_members)} sub={<Delta cur={i.new_members} prev={i.new_members_prev} enabled={cmp} />} />
        <Metric label="Monthly growth" value={rate === null ? "—" : `${rate > 0 ? "+" : ""}${rate}%`} sub="New members vs last month" />
      </div>

      <div>
        <Heading title="New members each week" hint="Last 12 weeks" />
        <Surface>
          <Bars
            data={i.joins_weekly.map((w) => w.joined)}
            label="New members per week, last 12 weeks"
            caption={["12 weeks ago", "This week"]}
          />
        </Surface>
      </div>

      <div>
        <Heading title="Active and inactive" />
        <Surface>
          <Bar value={a.active} total={base} />
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-supporting text-muted">Active</dt>
              <dd className="text-[20px] font-extrabold tabular-nums text-fg">{fmt(a.active)} <span className="text-secondary font-semibold text-muted">{base > 0 ? `${activePct}%` : ""}</span></dd>
            </div>
            <div>
              <dt className="text-supporting text-muted">Not yet active</dt>
              <dd className="text-[20px] font-extrabold tabular-nums text-fg">{fmt(Math.max(0, base - a.active))} <span className="text-secondary font-semibold text-muted">{base > 0 ? `${100 - activePct}%` : ""}</span></dd>
            </div>
          </dl>
        </Surface>
      </div>
      <Note>
        Growth counts members who joined and are still here. Members who joined and later left aren&apos;t included.
      </Note>
    </div>
  );
}

export function Engagement({ i }: { i: Insights }) {
  const base = i.base_members;
  const poll = pct(i.polls.voters, base);
  const types = i.by_type
    .filter((t) => t.posts > 0)
    .map((t) => ({ ...t, avg: t.interactors / t.posts }))
    .sort((x, y) => y.avg - x.avg);
  const top = Math.max(0.0001, ...types.map((t) => t.avg));
  const c = i.content;
  return (
    <div className="space-y-6">
      <Surface className="py-1">
        <div className="divide-y divide-line">
          <Row
            label="Posts and announcements" value={fmt(c.total)}
            sub={`${plural(c.announcements, "announcement", "announcements")} · ${plural(c.polls, "poll", "polls")} · ${plural(c.documents, "resource", "resources")}`}
          />
          <Row label="Discussions" value={fmt(i.discussion.discussions)} sub="Posts that received comments" />
          <Row label="Replies" value={fmt(i.discussion.comments + i.discussion.replies)} sub={`${fmt(i.discussion.comments)} comments · ${fmt(i.discussion.replies)} replies to comments`} />
          <Row label="Poll participation" value={poll === null ? "—" : `${poll}%`} sub={`${plural(i.polls.voters, "member", "members")} voted in a poll`} />
          <Row label="Resource interactions" value={fmt(i.resources.interactions)} sub={`Likes and saves · ${fmt(i.resources.added)} added this month`} />
        </div>
      </Surface>

      <div>
        <Heading title="Members taking part" hint="Last 12 weeks" />
        <Surface>
          <Bars
            data={i.activity.weeks.map((w) => w.active)}
            label="Active members per week, last 12 weeks"
            caption={["12 weeks ago", "This week"]}
          />
        </Surface>
      </div>

      <div>
        <Heading title="What drives engagement" hint="Members responding per post" />
        <Surface>
          {types.length === 0 ? (
            <p className="text-secondary leading-[1.5] text-muted">Nothing was published this month, so there is nothing to compare yet.</p>
          ) : (
            <ul className="space-y-4">
              {types.map((t) => (
                <li key={t.type}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg">{TYPE_PLURAL[t.type] ?? "Posts"}</span>
                    <span className="text-secondary tabular-nums text-muted">{plural(t.posts, "post", "posts")} · avg {Math.round(t.avg * 10) / 10}</span>
                  </div>
                  <Bar value={t.avg} total={top} />
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  );
}

export function Retention({ i }: { i: Insights }) {
  const a = i.activity;
  const rate = retentionRate(i);
  const last8 = a.weeks.filter((w) => w.w <= 7);
  const activeWeeks = last8.filter((w) => w.acts > 0).length;
  return (
    <div className="space-y-6">
      <Surface>
        <p className="text-supporting font-semibold text-muted">Retention rate</p>
        <p className="mt-1.5 text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-fg">{rate === null ? "—" : `${rate}%`}</p>
        <p className="mt-2.5 text-secondary leading-[1.55] text-muted">
          {rate !== null
            ? `Of the ${plural(a.prev_active, "member", "members")} who took part last month, ${fmt(a.returning)} took part again this month.`
            : i.history_complete
              ? "No one was active last month, so there is nothing to compare yet."
              : "Retention needs two full months of history. It will appear once this community is 60 days old."}
        </p>
        {rate !== null && <div className="mt-3.5"><Bar value={a.returning} total={a.prev_active} /></div>}
      </Surface>

      <div>
        <Heading title="Returning and newly active" hint="This month" />
        <Surface>
          <Bar value={a.returning} total={a.active} />
          <dl className="mt-3.5 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-supporting text-muted">Returning</dt>
              <dd className="text-[20px] font-extrabold tabular-nums text-fg">{fmt(a.returning)}</dd>
            </div>
            <div>
              <dt className="text-supporting text-muted">Newly active</dt>
              <dd className="text-[20px] font-extrabold tabular-nums text-fg">{fmt(a.newly_active)}</dd>
            </div>
          </dl>
        </Surface>
      </div>

      <div>
        <Heading title="Consistency" hint="Last 8 weeks" />
        <Surface>
          <div className="grid grid-cols-8 gap-1.5" role="img" aria-label={`Activity in ${activeWeeks} of the last 8 weeks`}>
            {last8.map((w) => (
              <span key={w.w} title={`${w.acts} contributions`} className={`h-8 rounded-md ${w.acts > 0 ? "bg-brand" : "bg-surface-elevated"}`} />
            ))}
          </div>
          <p className="mt-3 text-secondary text-muted">Active in {activeWeeks} of the last 8 weeks</p>
        </Surface>
      </div>
      <Note>
        A returning member took part last month and again this month. A newly active member took part this month but not last month.
      </Note>
    </div>
  );
}

const STATE_LABEL = { in_range: "In range", building: "Building", no_data: "Not enough data yet" } as const;

export function Rewards({ i }: { i: Insights }) {
  const copy = PROGRAMME_COPY[PROGRAMME_STATUS];
  const criteria = evaluateCriteria(i);
  const sum = summarize(criteria);
  return (
    <div className="space-y-6">
      <Surface>
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[17px] font-extrabold tracking-tight text-fg">Anaija Community Rewards</h2>
          <span className="inline-flex h-7 items-center rounded-full bg-brand/15 px-3 text-micro font-extrabold uppercase tracking-wide text-brand-ink">{copy.badge}</span>
        </div>
        <p className="mt-2.5 text-secondary leading-[1.6] text-muted">{copy.body}</p>
        <p className="mt-3 text-secondary leading-[1.6] text-muted">
          Recognition looks at meaningful activity, retention, engagement and community health. It is never based on sign-ups alone.
        </p>
      </Surface>

      <div>
        <Heading title="Your community against the proposed criteria" hint={`${sum.inRange} of ${sum.total} in range`} />
        <Surface className="py-1">
          <ul className="divide-y divide-line">
            {criteria.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3.5">
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${c.state === "in_range" ? "text-brand-ink" : "text-muted"}`}>
                  {c.state === "in_range" ? <Icon name="verifiedCheck" filled className="size-5" /> : <span className={`size-3.5 rounded-full border-2 ${c.state === "no_data" ? "border-dashed border-muted" : "border-muted"}`} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-fg">{c.label}</span>
                  <span className="block text-supporting leading-[1.4] text-muted">{c.need}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-secondary font-bold tabular-nums text-fg">{c.now}</span>
                  <span className="block text-micro text-muted">{STATE_LABEL[c.state]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      <div>
        <Heading title="Milestone progress" />
        <Surface><Milestones i={i} size={92} /></Surface>
      </div>

      <div>
        <Heading title="Monthly activity" hint="Contributions per week" />
        <Surface>
          <Bars data={i.activity.weeks.map((w) => w.acts)} label="Contributions per week, last 12 weeks" caption={["12 weeks ago", "This week"]} />
          <p className="mt-3 text-secondary text-muted">{plural(i.activity.contributions, "contribution", "contributions")} in the last 30 days</p>
        </Surface>
      </div>

      <Surface>
        <p className="text-supporting font-semibold text-muted">Recognition status</p>
        <p className="mt-1 text-[17px] font-extrabold text-fg">{copy.recognition}</p>
        <p className="mt-1.5 text-secondary leading-[1.55] text-muted">No reward balance or payment is shown because none has been approved.</p>
      </Surface>
    </div>
  );
}
