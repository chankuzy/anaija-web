"use client";

import { useState } from "react";
import { Chip, Label, messageOf, useFetch } from "@/components/community/kit";
import { buttonClass } from "@/components/ui/button";
import type { CommunityDetail } from "@/lib/api/communities";
import { MOMENT_TYPES, momentsApi } from "@/lib/api/moments";
import { TYPE_META } from "@/lib/moments/meta";

const LEVELS: [string, string][] = [["off", "Off"], ["member", "Members"], ["moderator", "Moderators"], ["admin", "Admins"]];
const OFFICIAL: [string, string][] = [["representative", "Representatives"], ["moderator", "Moderators"], ["admin", "Admins"]];

export function MomentSettings({ c }: { c: CommunityDetail }) {
  const q = useFetch(`mcfg:${c.id}`, () => momentsApi.settings(c.id), { persist: false });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (q.loading) return <p className="py-8 text-center text-secondary text-muted">Loading…</p>;
  const base = q.data?.settings;
  if (!base) return <p className="py-10 text-center text-secondary text-muted">Only admins can change Moment settings.</p>;
  const cur = { ...base, ...edits };
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await momentsApi.saveSettings(c.id, edits);
      setEdits({});
      q.reload();
      setMsg("Saved");
    } catch (e) {
      setMsg(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="px-1 text-secondary leading-[1.45] text-muted">Choose who may start each kind of Moment. Members can start the low-risk ones by default, with no approval step.</p>
      {MOMENT_TYPES.map((t) => (
        <div key={t}>
          <Label>{TYPE_META[t].title}</Label>
          <div className="flex flex-wrap gap-2">{LEVELS.map(([id, l]) => <Chip key={id} active={cur[t] === id} onClick={() => setEdits((e) => ({ ...e, [t]: id }))}>{l}</Chip>)}</div>
        </div>
      ))}
      <Label hint="Who can commit this community to an official Department War">Official challenges</Label>
      <div className="flex flex-wrap gap-2">{OFFICIAL.map(([id, l]) => <Chip key={id} active={cur.dept_war_official === id} onClick={() => setEdits((e) => ({ ...e, dept_war_official: id }))}>{l}</Chip>)}</div>
      <p className="mt-2 px-1 text-supporting leading-[1.4] text-muted">Representatives are class reps, course reps and departmental executives, plus any moderator.</p>
      {msg && <p role="status" className="mt-3 px-1 text-secondary text-muted">{msg}</p>}
      <button type="button" disabled={busy || !Object.keys(edits).length} onClick={() => void save()} className={buttonClass("primary", "mt-5 h-12 w-full")}>{busy ? "Saving…" : "Save"}</button>
    </div>
  );
}
