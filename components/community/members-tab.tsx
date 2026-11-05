"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail, type Member } from "@/lib/api/communities";
import { DesigBadge, Empty, ROLE_LABEL, ROLE_RANK, SectionHead, useFetch } from "./kit";
import { Actions } from "./members-sheet";

export function MembersTab({ c, onJoin }: { c: CommunityDetail; onJoin: () => void }) {
  const [page, setPage] = useState(1);
  const [extra, setExtra] = useState<Member[]>([]);
  const [more, setMore] = useState<boolean | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const first = useFetch(c.is_member ? `members:${c.id}` : null, () => communitiesApi.members(c.id, 1));
  const items = [...(first.data?.items ?? []), ...extra];
  const hasMore = more ?? first.data?.hasMore ?? false;
  const term = q.trim().toLowerCase();
  const shown = term ? items.filter((m) => `${m.name ?? ""} ${m.username ?? ""}`.toLowerCase().includes(term)) : items;

  async function loadMore() {
    try {
      const r = await communitiesApi.members(c.id, page + 1);
      setExtra((x) => [...x, ...r.items]);
      setMore(r.hasMore);
      setPage(page + 1);
    } catch {
      /* retry on next tap */
    }
  }

  if (!c.is_member) {
    return (
      <Empty title="Members can see each other" body="Join to see who's here, who leads it and who to ask.">
        {c.join_policy !== "invite" && c.request_status !== "pending" && (
          <button type="button" onClick={onJoin} className={buttonClass("primary", "h-10 px-5")}>{c.join_policy === "request" ? "Request to join" : "Join"}</button>
        )}
      </Empty>
    );
  }

  return (
    <div>
      {c.staff.length > 0 && !term && (
        <section className="mb-6">
          <SectionHead title="Leadership" />
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
            {c.staff.map((s) => (
              <Link key={s.id} href={s.username ? `/u/${encodeURIComponent(s.username)}` : "#"} className="flex w-[148px] shrink-0 flex-col items-start rounded-2xl border border-line bg-surface-subtle p-3 transition-colors active:bg-surface-interactive">
                <Avatar url={s.avatar} name={s.name} size={44} />
                <span className="mt-2.5 block w-full truncate text-[14px] font-bold text-fg">{s.name}</span>
                <span className="block w-full truncate text-supporting text-muted">{ROLE_LABEL[s.role]}</span>
                {s.designations[0] && <span className="mt-2"><DesigBadge d={s.designations[0]} /></span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <SectionHead title={`${c.members_count} ${c.members_count === 1 ? "member" : "members"}`} />
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className={`${inputClass} h-11 pl-11`} placeholder="Find a member" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {hasMore && term && <p className="mt-2 px-1 text-supporting text-muted">Searching the members loaded so far. Show more to widen it.</p>}

      <div className="mt-3">
        {first.loading ? (
          <div role="status" aria-busy="true" aria-label="Loading members" className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-3"><Sk className="size-11 rounded-full" /><Sk className="h-3.5 w-40 rounded-full" /></div>)}
          </div>
        ) : first.error && !first.data ? (
          <Empty title="Couldn't load members" body={first.error}><button type="button" onClick={first.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
        ) : shown.length === 0 ? (
          <Empty title="No one matches" body="Try another name or username." />
        ) : (
          <div className="divide-y divide-line">
            {shown.map((m) => {
              const canAct = c.can.moderate && ROLE_RANK[m.role] < ROLE_RANK[c.my_role ?? "member"];
              return (
                <div key={m.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <Link href={m.username ? `/u/${encodeURIComponent(m.username)}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar url={m.avatar} name={m.name} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-bold text-fg">{m.name}</span>
                          {(m.is_verified || m.campus_verified) && <Icon name="verifiedCheck" filled className="size-4 shrink-0 text-brand-ink" />}
                        </span>
                        <span className="block truncate text-supporting text-muted">@{m.username}{m.role !== "member" ? ` · ${ROLE_LABEL[m.role]}` : ""}</span>
                      </span>
                    </Link>
                    {canAct && (
                      <button type="button" aria-label="Manage member" onClick={() => setOpen(open === m.id ? null : m.id)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-interactive">
                        <Icon name="dots" filled className="size-5" />
                      </button>
                    )}
                  </div>
                  {m.designations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 pl-[56px]">{m.designations.map((d, i) => <DesigBadge key={i} d={d} />)}</div>}
                  {canAct && open === m.id && (
                    <Actions c={c} m={m} onChanged={() => { setOpen(null); setExtra([]); setMore(null); setPage(1); first.reload(); }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {hasMore && <button type="button" onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto mt-4 h-10")}>Show more</button>}
      </div>
    </div>
  );
}
