"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail, type DeskAccess, type Semester } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { timeAgo } from "@/lib/format";
import { Empty, Label, useFetch } from "./kit";

const ACCESS_TEXT: Record<DeskAccess, string> = {
  open: "Anyone with the link can join instantly.",
  restricted: "Joining needs approval from the owner or an assistant.",
  institutional: "Only students of this campus can join.",
};
const SEMESTER: Record<Semester, string> = { first: "First semester", second: "Second semester", summer: "Summer" };
const TYPE_LABEL: Record<string, string> = {
  past_question: "Past question", lecture_note: "Lecture note", slides: "Slides", textbook: "Textbook",
  assignment: "Assignment", syllabus: "Syllabus", project: "Project", other: "Other",
};
const day = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// The desk landing: identity, access, leaders, what's new, recent materials. One request (GET communities/desk/:ref).
export function DeskOverview({ c, onTab }: { c: CommunityDetail; onTab: (id: string) => void }) {
  const { status } = useAuth();
  const ov = useFetch(status === "loading" ? null : `desk:${c.id}:${status}:${c.is_member ? 1 : 0}`, () => communitiesApi.deskOverview(c.slug));
  const rel = useFetch(c.is_member ? `related:${c.id}` : null, () => communitiesApi.related(c.id));
  const d = ov.data;

  if (!d) {
    return ov.error ? (
      <Empty title="Couldn't load this Course Desk" body={ov.error}>
        <button type="button" onClick={ov.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
      </Empty>
    ) : (
      <div role="status" aria-busy="true" aria-label="Loading Course Desk" className="space-y-4">
        <Sk className="h-20 w-full rounded-2xl" />
        <Sk className="h-4 w-56 rounded-full" />
        <Sk className="h-4 w-40 rounded-full" />
      </div>
    );
  }

  const id = d.identity;
  const facts = ([
    ["Course", d.desk.course_title],
    ["Code", id.course_code],
    ["Campus", id.institution ? (id.institution.short_name ?? id.institution.name) : null],
    ["Department", id.department],
    ["Faculty", id.faculty],
    ["Level", id.level ? `${id.level} level` : null],
    ["Session", id.academic_session],
    ["Semester", d.desk.semester ? SEMESTER[d.desk.semester] : null],
    // An owner-typed name is shown only once an Anaija admin has verified the desk.
    ["Lecturer", d.desk.verified ? d.desk.lecturer_name : null],
  ] as [string, string | null][]).filter(([, v]) => !!v);
  const related = [...(rel.data?.desks ?? []), ...(rel.data?.communities ?? [])];

  return (
    <div className="space-y-6">
      <section className="px-1">
        {id.description ? <p className="whitespace-pre-wrap text-body leading-[1.6] text-fg/90">{id.description}</p> : null}
        <dl className="mt-3 divide-y divide-line">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-secondary text-muted">{k}</dt>
              <dd className="min-w-0 truncate text-right text-[15px] font-semibold text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-supporting leading-[1.5] text-muted">
          {ACCESS_TEXT[d.desk.access]}{" "}
          {d.desk.verified
            ? "Verified by Anaija as run by the course lecturer."
            : "Student-led: not verified by a lecturer, and not an official channel of the school."}
        </p>
      </section>

      {d.leaders.length > 0 && (
        <section>
          <Label>Course team</Label>
          <div className="divide-y divide-line">
            {d.leaders.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-1 py-3">
                <Avatar url={l.avatar} name={l.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-fg">{l.name}</p>
                  <p className="truncate text-supporting text-muted">
                    @{l.username} · {l.lecturer ? "Lecturer" : l.assistant ? "Course assistant" : l.role === "owner" ? "Owner" : "Moderator"}
                  </p>
                </div>
                {l.lecturer && <Icon name="verifiedCheck" filled className="size-5 text-brand-ink" />}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.announcements.length > 0 && (
        <section>
          <Label>Latest announcements</Label>
          <div className="divide-y divide-line">
            {d.announcements.map((a) => (
              <button key={a.id} type="button" onClick={() => onTab("posts")} className="flex w-full items-center gap-3 px-1 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-fg">{a.title}</span>
                  <span className="block text-supporting text-muted">
                    {a.pinned ? "Pinned · " : ""}{a.priority === "important" ? "Important · " : ""}{timeAgo(a.created_at)}
                  </span>
                </span>
                <Icon name="back" className="size-4 rotate-180 text-muted" />
              </button>
            ))}
          </div>
        </section>
      )}

      {d.upcoming.length > 0 && (
        <section>
          <Label>Coming up</Label>
          <div className="divide-y divide-line">
            {d.upcoming.map((u) => (
              <div key={u.id} className="px-1 py-3">
                <p className="truncate text-[15px] font-semibold text-fg">{u.title}</p>
                {u.event_at && <p className="text-supporting text-muted">{day(u.event_at)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.is_member && (
        <section>
          <Label>Recent materials</Label>
          {d.materials.length === 0 ? (
            <p className="px-1 text-secondary text-muted">No materials yet.{d.can.library ? " Add the first from the Materials tab." : ""}</p>
          ) : (
            <div className="divide-y divide-line">
              {d.materials.map((m) => (
                <button key={m.id} type="button" onClick={() => onTab("materials")} className="flex w-full items-center gap-3 px-1 py-3.5 text-left">
                  <Icon name="copy" className="size-5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-fg">{m.title}</span>
                    <span className="block truncate text-supporting text-muted">
                      {[TYPE_LABEL[m.doc_type] ?? "Document", m.uploader?.name ?? m.uploader?.username, timeAgo(m.created_at)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section>
          <Label>More for you on campus</Label>
          <div className="divide-y divide-line">
            {related.map((r) => (
              <Link key={r.id} href={`/c/${r.slug}`} className="flex items-center gap-3 px-1 py-3">
                <Avatar url={r.avatar} name={r.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-fg">{r.kind === "course_desk" ? (r.course_title ?? r.name) : r.name}</span>
                  <span className="block truncate text-supporting text-muted">
                    {[r.reason, r.kind === "course_desk" ? r.course_code : null, `${r.members_count} ${r.members_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
