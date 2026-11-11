"use client";

import { useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { Chip, Empty, Label, Sheet, useFetch } from "./kit";

const PERIODS = [7, 30] as const;
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : null);
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-interactive/60 px-4 py-3">
      <p className="text-[22px] font-extrabold leading-none tracking-tight text-fg">{value}</p>
      <p className="mt-1.5 text-supporting font-semibold text-fg">{label}</p>
      {sub && <p className="text-supporting text-muted">{sub}</p>}
    </div>
  );
}

// Lecturer, owner and admin only (the server enforces it). Every figure is counted from real rows. "Opens" are tracked
// views and "students" are distinct people, so both are shown and never mixed.
export function InsightsSheet({ c, onClose }: { c: CommunityDetail; onClose: () => void }) {
  const [days, setDays] = useState<number>(7);
  const ins = useFetch(`insights:${c.id}:${days}`, () => communitiesApi.deskInsights(c.id, days), { persist: false });
  const d = ins.data;

  let body: ReactNode;
  if (!d) {
    body = ins.error ? (
      <Empty title="Couldn't load insights" body={ins.error}>
        <button type="button" onClick={ins.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
      </Empty>
    ) : (
      <div role="status" aria-busy="true" aria-label="Loading insights" className="space-y-3 pt-3">
        <Sk className="h-20 w-full rounded-2xl" />
        <Sk className="h-28 w-full rounded-2xl" />
        <Sk className="h-20 w-full rounded-2xl" />
      </div>
    );
  } else {
    const max = Math.max(1, ...d.material.series.map((s) => s.opens));
    const first = d.material.series[0];
    const last = d.material.series[d.material.series.length - 1];
    const x = d.discussions;
    body = (
      <>
        <p className="px-1 pt-2 text-supporting leading-[1.45] text-muted">
          {d.tracking_started
            ? `Views are counted from ${new Date(d.tracking_started).toLocaleDateString(undefined, { dateStyle: "medium" })}. Anything before that is not included.`
            : "No views have been tracked yet."}
        </p>

        <Label>Students</Label>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Students" value={d.students} sub={`${d.staff} on the course team`} />
          <Stat
            label={`Active in ${d.period_days} days`}
            value={d.active_students}
            sub={pct(d.active_students, d.students) !== null ? `${pct(d.active_students, d.students)}% of students` : undefined}
          />
        </div>

        <Label>Materials</Label>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Opens" value={d.material.opens} sub={`in ${d.period_days} days`} />
          <Stat label="Students who opened" value={d.material.unique_users} sub={pct(d.material.unique_users, d.students) !== null ? `${pct(d.material.unique_users, d.students)}% of students` : undefined} />
        </div>
        <div className="mt-3 rounded-2xl bg-surface-interactive/60 px-4 py-3">
          <div role="img" aria-label="Material opens per day, last 14 days" className="flex h-20 items-end gap-1">
            {d.material.series.map((s) => (
              <span
                key={s.day}
                title={`${dayLabel(s.day)}: ${s.opens} opens by ${s.users} students`}
                className={`flex-1 rounded-t ${s.opens > 0 ? "bg-brand" : "bg-surface-elevated"}`}
                style={{ height: `${Math.max(4, Math.round((100 * s.opens) / max))}%` }}
              />
            ))}
          </div>
          {first && last && (
            <p className="mt-1.5 flex justify-between text-micro text-muted">
              <span>{dayLabel(first.day)}</span>
              <span>Last 14 days</span>
              <span>{dayLabel(last.day)}</span>
            </p>
          )}
        </div>
        {d.material.top.length > 0 ? (
          <div className="mt-2 divide-y divide-line">
            {d.material.top.map((t) => (
              <div key={t.resource_id} className="flex items-baseline gap-3 px-1 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">{t.title}</span>
                <span className="shrink-0 text-supporting text-muted">{t.opens} opens · {t.users} students</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 px-1 text-secondary text-muted">No material has been opened in this period.</p>
        )}

        <Label>Announcements</Label>
        {d.announcements.length === 0 ? (
          <p className="px-1 text-secondary text-muted">No announcements yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {d.announcements.map((a) => (
              <div key={a.post_id} className="px-1 py-2.5">
                <p className="truncate text-[15px] font-semibold text-fg">{a.title ?? "Announcement"}</p>
                <p className="text-supporting text-muted">
                  {a.unique_opens} of {d.students} students opened it · {a.total_opens} total opens
                </p>
              </div>
            ))}
          </div>
        )}

        <Label>Discussions</Label>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Questions" value={x.questions_period} sub={`${x.questions_total} in total`} />
          <Stat label="Answered" value={x.resolved} sub={`of ${x.questions_total} questions`} />
          <Stat label="Unanswered" value={x.unanswered} sub="open with no replies" />
          <Stat label="Answers" value={x.responses_period} sub={`${x.responders_period} people · ${x.responses_total} in total`} />
        </div>

        <Label>Polls</Label>
        {d.polls.items.length === 0 ? (
          <p className="px-1 text-secondary text-muted">No polls yet.</p>
        ) : (
          <>
            {d.polls.avg_participation !== null && <p className="px-1 pb-1 text-secondary text-muted">Average participation {d.polls.avg_participation}%</p>}
            <div className="divide-y divide-line">
              {d.polls.items.map((p) => (
                <div key={p.post_id} className="flex items-baseline gap-3 px-1 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">{p.question ?? "Poll"}</span>
                  <span className="shrink-0 text-supporting text-muted">{p.voters} voted{p.participation !== null ? ` · ${p.participation}%` : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <Sheet title="Course insights" onClose={onClose} wide>
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => <Chip key={p} active={days === p} onClick={() => setDays(p)}>{`Last ${p} days`}</Chip>)}
      </div>
      {body}
    </Sheet>
  );
}
