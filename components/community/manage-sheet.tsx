"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { inputClass } from "@/components/ui/input";
import { communitiesApi, type CommunityDetail, type Policy, type Role } from "@/lib/api/communities";
import { MomentSettings } from "@/components/moments/settings-pane";
import { AREA, Chip, ChoiceList, Label, Sheet, messageOf, shareLink, siteUrl, useFetch } from "./kit";

function Requests({ c, reload }: { c: CommunityDetail; reload: () => void }) {
  const q = useFetch(`req:${c.id}`, () => communitiesApi.requests(c.id));
  const [err, setErr] = useState<string | null>(null);
  async function decide(id: number, approve: boolean) {
    setErr(null);
    try {
      await communitiesApi.decide(c.id, id, approve);
      q.patch((l) => l.filter((r) => r.id !== id));
      reload();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  if (q.loading) return <p className="py-8 text-center text-secondary text-muted">Loading…</p>;
  if (!q.data?.length) return <p className="py-10 text-center text-secondary text-muted">No pending requests.</p>;
  return (
    <div className="space-y-2">
      {q.data.map((r) => (
        <div key={r.id} className="rounded-[20px] bg-surface-interactive/60 p-3">
          <div className="flex items-center gap-3">
            <Avatar url={r.user.avatar} name={r.user.name} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-fg">{r.user.name}</p>
              <p className="truncate text-supporting text-muted">@{r.user.username}</p>
            </div>
            <button type="button" onClick={() => void decide(r.id, true)} className="h-9 rounded-full bg-brand px-4 text-secondary font-extrabold text-brand-fg">Approve</button>
            <button type="button" onClick={() => void decide(r.id, false)} className="h-9 rounded-full bg-surface-elevated px-4 text-secondary font-bold text-fg">Reject</button>
          </div>
          {r.message && <p className="mt-2 text-secondary leading-[1.4] text-muted">“{r.message}”</p>}
        </div>
      ))}
      {err && <p role="alert" className="text-secondary text-danger">{err}</p>}
    </div>
  );
}

function Invites({ c }: { c: CommunityDetail }) {
  const q = useFetch(c.can.invite ? `inv:${c.id}` : null, () => communitiesApi.invites(c.id));
  const [label, setLabel] = useState("");
  const [uses, setUses] = useState("");
  const [hours, setHours] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!c.can.invite) return <p className="py-10 text-center text-secondary text-muted">You can&apos;t manage invitations here.</p>;

  async function create() {
    setErr(null);
    try {
      await communitiesApi.createInvite(c.id, { label: label.trim() || undefined, max_uses: uses ? Number(uses) : null, expires_hours: hours });
      setLabel("");
      setUses("");
      q.reload();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  async function copy(token: string, name: string) {
    const r = await shareLink(`${siteUrl()}/join/${token}`, `Join ${name}`);
    if (r === "copied") setNote("Link copied");
  }
  return (
    <div>
      <p className="px-1 text-secondary leading-[1.45] text-muted">An invitation link adds people straight in, even if the community is invite-only. Revoke it any time.</p>
      <input className={`${inputClass} mt-3 h-11`} placeholder="Label, e.g. WhatsApp group" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
      <input className={`${inputClass} mt-2 h-11`} inputMode="numeric" placeholder="Max uses (optional)" value={uses} onChange={(e) => setUses(e.target.value.replace(/\D/g, ""))} />
      <div className="mt-2 flex flex-wrap gap-2">
        {([["No expiry", null], ["24 hours", 24], ["7 days", 168], ["30 days", 720]] as [string, number | null][]).map(([l, h]) => (
          <Chip key={l} active={hours === h} onClick={() => setHours(h)}>{l}</Chip>
        ))}
      </div>
      <button type="button" onClick={() => void create()} className="mt-3 h-11 w-full rounded-full bg-brand text-[15px] font-extrabold text-brand-fg">Create invitation link</button>
      {err && <p role="alert" className="mt-2 text-secondary text-danger">{err}</p>}
      {note && <p className="mt-2 text-center text-secondary text-muted">{note}</p>}
      <div className="mt-5 space-y-2">
        {(q.data ?? []).map((i) => {
          const dead = !!i.revoked_at;
          return (
            <div key={i.id} className={`rounded-[20px] bg-surface-interactive/60 p-3 ${dead ? "opacity-50" : ""}`}>
              <p className="text-[14px] font-bold text-fg">{i.label || "Invitation"}</p>
              <p className="mt-0.5 text-supporting text-muted">
                {i.uses}{i.max_uses ? ` / ${i.max_uses}` : ""} used{i.expires_at ? ` · expires ${new Date(i.expires_at).toLocaleDateString()}` : ""}{dead ? " · revoked" : ""}
              </p>
              {!dead && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void copy(i.token, c.name)} className="h-9 rounded-full bg-surface-elevated px-4 text-secondary font-bold text-fg">Copy link</button>
                  <button type="button" onClick={async () => { await communitiesApi.revokeInvite(c.id, i.id).catch(() => {}); q.reload(); }} className="h-9 rounded-full px-4 text-secondary font-bold text-danger">Revoke</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Reports({ c }: { c: CommunityDetail }) {
  const q = useFetch(`rep:${c.id}`, () => communitiesApi.reports(c.id));
  const [err, setErr] = useState<string | null>(null);
  async function handle(id: number, action: "dismiss" | "remove") {
    setErr(null);
    try {
      await communitiesApi.reportHandle(c.id, id, action);
      q.patch((l) => l.filter((r) => r.id !== id));
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  if (q.loading) return <p className="py-8 text-center text-secondary text-muted">Loading…</p>;
  if (!q.data?.length) return <p className="py-10 text-center text-secondary text-muted">No open reports. Anonymous session reports are handled inside each session.</p>;
  return (
    <div className="space-y-2">
      {q.data.map((r) => (
        <div key={r.id} className="rounded-[20px] bg-surface-interactive/60 p-3">
          <p className="text-supporting font-bold uppercase tracking-wide text-muted">{r.target_kind} · {r.reason}</p>
          {r.preview?.text && <p className="mt-1.5 line-clamp-4 text-body leading-[1.4] text-fg">{r.preview.text}</p>}
          {r.details && <p className="mt-1 text-secondary text-muted">“{r.details}”</p>}
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => void handle(r.id, "remove")} className="h-9 rounded-full bg-danger/90 px-4 text-secondary font-bold text-white">Remove content</button>
            <button type="button" onClick={() => void handle(r.id, "dismiss")} className="h-9 rounded-full bg-surface-elevated px-4 text-secondary font-bold text-fg">Dismiss</button>
          </div>
        </div>
      ))}
      {err && <p role="alert" className="text-secondary text-danger">{err}</p>}
    </div>
  );
}

const PERMS: [string, string][] = [
  ["post", "Who can post"], ["chat", "Who can chat"], ["invite", "Who can invite"],
  ["session", "Who can start sessions"], ["announce", "Who can announce"], ["library", "Who can add to the library"],
];
const LEVELS: [Role, string][] = [["member", "Members"], ["moderator", "Moderators"], ["admin", "Admins"]];

function Settings({ c, reload, onClose }: { c: CommunityDetail; reload: () => void; onClose: () => void }) {
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description ?? "");
  const [join, setJoin] = useState<Policy>(c.join_policy);
  const [listed, setListed] = useState(c.discoverability);
  const [read, setRead] = useState(c.read_policy);
  const [perms, setPerms] = useState<Record<string, Role>>(c.permissions ?? {});
  const [rules, setRules] = useState(c.rules.map((r) => r.text).join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await communitiesApi.update(c.id, {
        name: name.trim(), description: description.trim(), join_policy: join, discoverability: listed, read_policy: read,
        permissions: perms, rules: rules.split("\n").map((t) => t.trim()).filter(Boolean),
      });
      reload();
      onClose();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <div>
      <Label>Name</Label>
      <input className={inputClass} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <Label>Description</Label>
      <textarea className={AREA} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Label>Who can join</Label>
      <ChoiceList<Policy> value={join} onChange={setJoin} options={[
        { id: "open", title: "Anyone", desc: "Instant join." }, { id: "request", title: "With approval", desc: "Moderators approve requests." }, { id: "invite", title: "Invite only", desc: "Invitation links only." },
      ]} />
      <Label>Discoverability</Label>
      <ChoiceList value={listed} onChange={setListed} options={[
        { id: "listed", title: "Searchable", desc: "Shown in search." }, { id: "unlisted", title: "Unlisted", desc: "Link only." },
      ]} />
      <Label>Who can read</Label>
      <ChoiceList value={read} onChange={setRead} options={[
        { id: "public_preview", title: "Public preview", desc: "Feed visible to non-members." }, { id: "members_only", title: "Members only", desc: "Nothing visible before joining." },
      ]} />
      {PERMS.map(([k, l]) => (
        <div key={k}>
          <Label>{l}</Label>
          <div className="flex gap-2">
            {LEVELS.map(([r, rl]) => (
              <Chip key={r} active={perms[k] === r} onClick={() => setPerms((p) => ({ ...p, [k]: r }))}>{rl}</Chip>
            ))}
          </div>
        </div>
      ))}
      <Label hint="One per line, up to 10">Rules</Label>
      <textarea className={AREA} value={rules} onChange={(e) => setRules(e.target.value)} />
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => void save()} className="mt-5 h-12 w-full rounded-full bg-brand text-[15px] font-extrabold text-brand-fg disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
    </div>
  );
}

type Pane = "requests" | "invites" | "reports" | "moments" | "settings";

export function ManageSheet({ c, reload, onClose }: { c: CommunityDetail; reload: () => void; onClose: () => void }) {
  const [pane, setPane] = useState<Pane>(c.join_policy === "request" ? "requests" : "reports");
  const panes: [Pane, string][] = [["requests", "Requests"], ["invites", "Invites"], ["reports", "Reports"]];
  if (c.can.manage) panes.push(["moments", "Moments"], ["settings", "Settings"]);
  return (
    <Sheet title="Manage" onClose={onClose} wide>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {panes.map(([id, label]) => (
          <Chip key={id} active={pane === id} onClick={() => setPane(id)}>{label}</Chip>
        ))}
      </div>
      {pane === "requests" && <Requests c={c} reload={reload} />}
      {pane === "invites" && <Invites c={c} />}
      {pane === "reports" && <Reports c={c} />}
      {pane === "moments" && c.can.manage && <MomentSettings c={c} />}
      {pane === "settings" && c.can.manage && <Settings c={c} reload={reload} onClose={onClose} />}
    </Sheet>
  );
}
