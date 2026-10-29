"use client";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import type { CommunityDetail } from "@/lib/api/communities";
import { DesigBadge, Label, ROLE_LABEL, categoryLabel } from "./kit";

const JOIN_TEXT = { open: "Anyone can join instantly.", request: "Joining needs approval from a moderator.", invite: "Joining needs an invitation link." };

// Information only. Actions (share, members, manage, notifications, leave) live in the header menu.
export function AboutTab({ c }: { c: CommunityDetail }) {
  const details = [categoryLabel(c.category), c.course_code, c.department, c.level && `${c.level} level`, c.academic_session, c.faculty].filter(Boolean) as string[];

  return (
    <div className="space-y-7">
      <section className="px-1">
        {c.description ? <p className="whitespace-pre-wrap text-body leading-[1.6] text-fg/90">{c.description}</p> : <p className="text-secondary text-muted">No description yet.</p>}
        <p className="mt-3 text-supporting text-muted">{details.join(" · ")}</p>
        <p className="mt-3 text-supporting leading-[1.5] text-muted">
          {JOIN_TEXT[c.join_policy]}{" "}
          {c.discoverability === "listed" ? "Appears in search." : "Unlisted: only people with the link can find it."}{" "}
          {c.read_policy === "public_preview" ? "Non-members can read the feed. Chat and Library are members-only." : "Everything is members-only."}
        </p>
      </section>

      {c.rules.length > 0 && (
        <section>
          <Label>Rules</Label>
          <ol className="divide-y divide-white/[0.06]">
            {c.rules.map((r, i) => (
              <li key={i} className="flex gap-4 px-1 py-3 text-body leading-[1.45] text-fg/90">
                <span className="w-4 shrink-0 text-muted">{i + 1}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.staff.length > 0 && (
        <section>
          <Label>Leadership</Label>
          <div className="divide-y divide-white/[0.06]">
            {c.staff.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-1 py-3">
                <Avatar url={s.avatar} name={s.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-fg">{s.name}</p>
                  <p className="truncate text-supporting text-muted">@{s.username} · {ROLE_LABEL[s.role]}</p>
                  {s.designations.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{s.designations.map((d, i) => <DesigBadge key={i} d={d} />)}</div>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-supporting leading-[1.4] text-muted">Titles are set by this community&apos;s admins. They are not an endorsement by Anaija or a school.</p>
        </section>
      )}

      {c.links.length > 0 && (
        <section>
          <Label>Links</Label>
          <div className="divide-y divide-white/[0.06]">
            {c.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 px-1 py-3.5 text-[15px] font-semibold text-fg transition-opacity active:opacity-60">
                <Icon name="link" className="size-5 text-muted" />
                <span className="truncate">{l.label}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
