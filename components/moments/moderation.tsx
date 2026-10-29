"use client";

import { useState } from "react";
import { AREA, Sheet, messageOf, useFetch } from "@/components/community/kit";
import { Group, Toggle } from "@/components/settings/settings-kit";
import { momentsApi, type Entry, type MomentReport, type QueueItem } from "@/lib/api/moments";

const FLAG: Record<string, string> = { handle: "Contains a handle", named_person: "Mentions a named person", accusation: "Possible accusation" };

// Moderators see the text and the alias at most. Never the account behind it.
export function RemoveSheet({ code, entry, war = false, onClose, onDone }: { code: string; entry: Entry; war?: boolean; onClose: () => void; onDone: (id: number) => void }) {
  const [reason, setReason] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      if (war) await momentsApi.warRemove(code, entry.id, reason.trim() || undefined);
      else await momentsApi.moderate(code, { entry_id: entry.id, action: "remove", reason: reason.trim() || undefined, block });
      onDone(entry.id);
      onClose();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <Sheet title="Remove this" onClose={onClose}>
      <textarea className={`${AREA} min-h-[80px]`} maxLength={200} placeholder="Reason (kept in the moderation log)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {!war && <div className="mt-3"><Group><Toggle icon="forbidden" label="Also block this participant (you won't see who they are)" value={block} onChange={setBlock} /></Group></div>}
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => void go()} className="mt-5 h-12 w-full rounded-full bg-danger text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? "Removing…" : "Remove"}</button>
    </Sheet>
  );
}

export function QueueSheet({ code, onClose, onChanged }: { code: string; onClose: () => void; onChanged: () => void }) {
  const q = useFetch(`mq:${code}`, () => momentsApi.queue(code), { persist: false });
  const [err, setErr] = useState<string | null>(null);
  async function act(it: QueueItem, action: "approve" | "reject") {
    setErr(null);
    try {
      await momentsApi.moderate(code, { entry_id: it.id, action });
      q.patch((l) => l.filter((x) => x.id !== it.id));
      onChanged();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  return (
    <Sheet title="Confession queue" onClose={onClose} wide>
      <p className="px-1 pb-3 text-secondary leading-[1.4] text-muted">Nothing is revealed until you approve it. Reject anything that names or accuses a real person, or shares private details.</p>
      {q.loading ? <p className="py-8 text-center text-secondary text-muted">Loading…</p> : !q.data?.length ? <p className="py-10 text-center text-secondary text-muted">Nothing waiting for review.</p> : (
        <div className="space-y-2">
          {q.data.map((it) => (
            <div key={it.id} className="rounded-[20px] bg-surface-interactive/60 p-3">
              {it.flags.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{it.flags.map((f) => <span key={f} className="rounded-pill bg-warm/15 px-2.5 py-1 text-micro font-bold text-warm">{FLAG[f] ?? f}</span>)}</div>}
              <p className="selectable whitespace-pre-wrap text-body leading-[1.45] text-fg">{it.body}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" disabled={!it.can_approve} onClick={() => void act(it, "approve")} className="h-9 rounded-full bg-brand px-4 text-secondary font-extrabold text-brand-fg disabled:opacity-40">Approve</button>
                <button type="button" onClick={() => void act(it, "reject")} className="h-9 rounded-full bg-surface-elevated px-4 text-secondary font-bold text-fg">Reject</button>
                {!it.can_approve && <span className="text-supporting text-muted">Flagged: needs a community moderator</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
    </Sheet>
  );
}

export function ReportsSheet({ code, onClose, onChanged }: { code: string; onClose: () => void; onChanged: () => void }) {
  const q = useFetch(`mrep:${code}`, () => momentsApi.reports(code), { persist: false });
  const [err, setErr] = useState<string | null>(null);
  async function handle(r: MomentReport, action: "dismiss" | "remove", block = false) {
    setErr(null);
    try {
      await momentsApi.reportHandle(code, { report_id: r.id, action, block });
      q.patch((l) => l.filter((x) => x.id !== r.id));
      if (action === "remove") onChanged();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  return (
    <Sheet title="Reports" onClose={onClose} wide>
      {q.loading ? <p className="py-8 text-center text-secondary text-muted">Loading…</p> : !q.data?.length ? <p className="py-10 text-center text-secondary text-muted">No open reports.</p> : (
        <div className="space-y-2">
          {q.data.map((r) => (
            <div key={r.id} className="rounded-[20px] bg-surface-interactive/60 p-3">
              <p className="text-supporting font-bold uppercase tracking-wide text-muted">{r.reason}{r.preview?.alias ? ` · ${r.preview.alias}` : r.entry_id ? "" : " · the Moment itself"}</p>
              {r.preview && <p className="mt-1.5 line-clamp-4 text-body leading-[1.4] text-fg">{r.preview.body}</p>}
              {r.details && <p className="mt-1 text-secondary text-muted">“{r.details}”</p>}
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handle(r, "remove")} className="h-9 rounded-full bg-danger/90 px-4 text-secondary font-bold text-white">{r.entry_id ? "Remove" : "Take down"}</button>
                {r.entry_id && <button type="button" onClick={() => void handle(r, "remove", true)} className="h-9 rounded-full bg-surface-elevated px-4 text-secondary font-bold text-fg">Remove + block</button>}
                <button type="button" onClick={() => void handle(r, "dismiss")} className="h-9 rounded-full px-4 text-secondary font-bold text-muted">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
    </Sheet>
  );
}
