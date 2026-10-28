"use client";

import { useState } from "react";
import Link from "next/link";
import { Group, Toggle } from "@/components/settings/settings-kit";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { communitiesApi, type CommunityDetail, type SessionInfo } from "@/lib/api/communities";
import { AREA, Chip, Label, Sheet, messageOf, shareLink, siteUrl } from "./kit";

const ENDS: [string, number | null][] = [["No end", null], ["1 hour", 1], ["6 hours", 6], ["24 hours", 24], ["3 days", 72], ["7 days", 168]];

export function SessionCreate({ c, onClose, onCreated }: { c: CommunityDetail; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [endH, setEndH] = useState<number | null>(24);
  const [replies, setReplies] = useState(true);
  const [reactions, setReactions] = useState(true);
  const [preview, setPreview] = useState(c.read_policy === "public_preview");
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<SessionInfo | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const startIso = start ? new Date(start).toISOString() : null;
      const base = startIso ? Date.parse(startIso) : Date.now();
      const s = await communitiesApi.sessionCreate(c.id, {
        title: title.trim(), description: description.trim() || undefined, starts_at: startIso,
        ends_at: endH ? new Date(base + endH * 3_600_000).toISOString() : null,
        replies_enabled: replies, reactions_enabled: reactions, allow_preview: preview, notify_members: notify,
      });
      setDone(s);
      onCreated();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const url = `${siteUrl()}/s/${done.code}`;
    return (
      <Sheet title="Your session is ready" onClose={onClose}>
        <p className="px-1 text-secondary leading-[1.45] text-muted">Share this link in your class WhatsApp group. Students open it, sign up if they need to, and land right here.</p>
        <p className="mt-4 select-text break-all rounded-2xl bg-surface-interactive p-4 text-[14px] font-semibold text-fg selectable">{url}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={async () => { const r = await shareLink(url, done.title); if (r === "copied") setNote("Link copied"); }} className={buttonClass("primary", "h-11 px-5")}>Share / copy link</button>
          <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${done.title}\n${url}`)}`, "_blank", "noopener")} className={buttonClass("outline", "h-11 px-5")}>WhatsApp</button>
          <Link href={`/s/${done.code}`} onClick={onClose} className={buttonClass("outline", "h-11 px-5")}>Open session</Link>
        </div>
        {note && <p className="mt-3 text-center text-secondary text-muted">{note}</p>}
      </Sheet>
    );
  }

  return (
    <Sheet title="Anonymous session" onClose={onClose} wide>
      <p className="px-1 text-secondary leading-[1.45] text-muted">A temporary feed where members post anonymously, react and reply. Posts appear instantly. You can end it any time.</p>
      <Label>Title</Label>
      <input className={inputClass} maxLength={120} placeholder="e.g. Anonymous Night" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label hint="Optional">Description</Label>
      <textarea className={`${AREA} min-h-[80px]`} maxLength={500} placeholder="What should people share?" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Label hint="Leave empty to start now">Start</Label>
      <input type="datetime-local" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
      <Label>Ends</Label>
      <div className="flex flex-wrap gap-2">
        {ENDS.map(([l, h]) => <Chip key={l} active={endH === h} onClick={() => setEndH(h)}>{l}</Chip>)}
      </div>
      <div className="mt-5">
        <Group>
          <Toggle icon="reply" label="Allow replies" value={replies} onChange={setReplies} />
          <Toggle icon="heart" label="Allow reactions" value={reactions} onChange={setReactions} />
          <Toggle icon="eye" label="Let non-members preview" value={preview} onChange={setPreview} />
          <Toggle icon="bell" label="Notify members when it goes live" value={notify} onChange={setNotify} />
        </Group>
      </div>
      {err && <p role="alert" className="mt-3 px-1 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={!title.trim() || busy} onClick={() => void submit()} className={buttonClass("primary", "mt-5 h-12 w-full")}>{busy ? "Creating…" : "Create session"}</button>
    </Sheet>
  );
}
