"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { communitiesApi, type CommunityDetail, type DesigKind, type Member, type Role } from "@/lib/api/communities";
import { confirmDialog } from "@/lib/ui/dialog";
import { Chip, DESIG_LABEL, DesigBadge, ROLE_LABEL, ROLE_RANK, Sheet, messageOf, useFetch } from "./kit";
import { inputClass } from "@/components/ui/input";

function Actions({ c, m, onChanged }: { c: CommunityDetail; m: Member; onChanged: () => void }) {
  const [kind, setKind] = useState<DesigKind>("course_rep");
  const [scope, setScope] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(messageOf(e));
    }
  };
  const roles: Role[] = c.my_role === "owner" ? ["member", "moderator", "admin"] : ["member", "moderator"];
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-surface-interactive p-3">
      {c.can.manage && (
        <>
          <div>
            <p className="pb-1.5 text-micro font-bold uppercase tracking-[0.08em] text-muted">Role</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <Chip key={r} active={m.role === r} onClick={() => void run(() => communitiesApi.memberRole(c.id, m.id, r))}>{ROLE_LABEL[r]}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="pb-1.5 text-micro font-bold uppercase tracking-[0.08em] text-muted">Designation (a visible title, no extra power)</p>
            {m.designations.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {m.designations.map((d) => (
                  <button key={d.id} type="button" onClick={() => d.id && void run(() => communitiesApi.revokeDesignation(c.id, d.id as number))} className="inline-flex items-center gap-1">
                    <DesigBadge d={d} />
                    <Icon name="close" className="size-3.5 text-muted" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DESIG_LABEL) as DesigKind[]).map((k) => (
                <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{DESIG_LABEL[k]}</Chip>
              ))}
            </div>
            <input className={`${inputClass} mt-2 h-11`} placeholder="Scope, e.g. CSC 301 or 300L Computer Science" maxLength={40} value={scope} onChange={(e) => setScope(e.target.value)} />
            <label className="mt-2 flex items-center gap-2 px-1 text-secondary text-fg">
              <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
              Can publish official announcements
            </label>
            <button
              type="button"
              onClick={() => void run(() => communitiesApi.grantDesignation(c.id, { user_id: m.id, kind, scope_label: scope.trim() || undefined, can_announce: announce }))}
              className="mt-2 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg"
            >
              Grant title
            </button>
          </div>
        </>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await confirmDialog({ title: `Remove ${m.name ?? "this member"}?`, confirmLabel: "Remove", danger: true })) void run(() => communitiesApi.memberRemove(c.id, m.id));
          }}
          className="h-10 flex-1 rounded-full bg-surface-elevated text-secondary font-bold text-fg"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await confirmDialog({ title: `Ban ${m.name ?? "this member"}?`, message: "They can't rejoin until you lift the ban.", confirmLabel: "Ban", danger: true })) void run(() => communitiesApi.ban(c.id, m.id));
          }}
          className="h-10 flex-1 rounded-full bg-danger/90 text-secondary font-bold text-white"
        >
          Ban
        </button>
      </div>
      {err && <p role="alert" className="text-secondary text-danger">{err}</p>}
    </div>
  );
}

export function MembersSheet({ c, onClose }: { c: CommunityDetail; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [extra, setExtra] = useState<Member[]>([]);
  const [more, setMore] = useState<boolean | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const first = useFetch(`members:${c.id}`, () => communitiesApi.members(c.id, 1));
  const items = [...(first.data?.items ?? []), ...extra];
  const hasMore = more ?? first.data?.hasMore ?? false;

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

  return (
    <Sheet title={`${c.members_count} members`} onClose={onClose} wide>
      {first.loading ? <p className="py-8 text-center text-secondary text-muted">Loading…</p> : first.error ? <p className="py-8 text-center text-secondary text-danger">{first.error}</p> : (
        <div className="space-y-2">
          {items.map((m) => {
            const canAct = c.can.moderate && ROLE_RANK[m.role] < ROLE_RANK[c.my_role ?? "member"];
            return (
              <div key={m.id} className="rounded-[20px] bg-surface-interactive/60 p-3">
                <div className="flex items-center gap-3">
                  <Avatar url={m.avatar} name={m.name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-fg">{m.name}</p>
                    <p className="truncate text-supporting text-muted">@{m.username}{m.role !== "member" ? ` · ${ROLE_LABEL[m.role]}` : ""}</p>
                  </div>
                  {canAct && (
                    <button type="button" aria-label="Manage member" onClick={() => setOpen(open === m.id ? null : m.id)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/10">
                      <Icon name="dots" filled className="size-5" />
                    </button>
                  )}
                </div>
                {m.designations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">{m.designations.map((d, i) => <DesigBadge key={i} d={d} />)}</div>
                )}
                {canAct && open === m.id && <Actions c={c} m={m} onChanged={() => { setOpen(null); setExtra([]); setMore(null); setPage(1); first.reload(); }} />}
              </div>
            );
          })}
          {hasMore && <button type="button" onClick={() => void loadMore()} className="mx-auto mt-2 block h-10 rounded-full bg-surface-interactive px-6 text-secondary font-bold text-fg">Show more</button>}
        </div>
      )}
    </Sheet>
  );
}
