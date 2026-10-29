"use client";

import { useState } from "react";
import { Chip, Empty, ReportSheet, messageOf } from "@/components/community/kit";
import { AREA } from "@/components/community/kit";
import { buttonClass } from "@/components/ui/button";
import { Sk } from "@/components/ui/skeleton";
import { cfgOf, momentsApi, newKey, type Entry, type HotSeatCfg } from "@/lib/api/moments";
import { Composer, EntryCard, Gate, useEntryList, useReact, type ViewProps } from "./kit";
import { RemoveSheet } from "./moderation";

type Tab = "open" | "answered" | "skipped";

export function HotSeat({ m, code, version, reload, show }: ViewProps) {
  const v = m.viewer;
  const c = cfgOf<HotSeatCfg>(m);
  const [tab, setTab] = useState<Tab>("open");
  const list = useEntryList(code, { filter: tab }, v.can_view, version);
  const react = useReact(code, list.patchOne, show, v.can_participate, v.authenticated);
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [report, setReport] = useState<Entry | null>(null);
  const [remove, setRemove] = useState<Entry | null>(null);
  const asking = m.status === "active" && !v.is_host;

  async function send(body: string, anonymous: boolean) {
    setBusy(true);
    try {
      const r = await momentsApi.entry(code, { body, anonymous, client_key: newKey() });
      if (tab === "open") list.add(r.entry);
      show("Your question is in");
      reload();
      return true;
    } catch (e) {
      show(messageOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function act(e: Entry, action: "answer" | "skip" | "dismiss" | "reopen", answer?: string) {
    try {
      await momentsApi.answer(code, { entry_id: e.id, action, answer });
      list.drop(e.id);
      if (action === "answer") { setAnswering(null); setDraft(""); }
      reload();
    } catch (err) {
      show(messageOf(err));
    }
  }

  const tabs: [Tab, string][] = [["open", `Open · ${c.open_count ?? 0}`], ["answered", `Answered · ${c.answered_count ?? 0}`]];
  if (v.is_host) tabs.push(["skipped", "Skipped"]);

  return (
    <div className="mt-4 space-y-3">
      {asking && v.can_participate ? (
        <Composer placeholder="Send a question to the host" cta="Send question" max={300} allowAnon={m.allow_anonymous_entries} busy={busy} onSend={send}
          hint="Up to 5 questions. Be respectful: the host can skip anything." />
      ) : !v.can_participate && m.status === "active" ? <Gate m={m} onJoined={reload} /> : null}
      {m.status !== "active" && m.status !== "scheduled" && (
        <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-secondary text-muted">{m.status === "closed" ? "Questions are closed. The host may still answer." : "This Hot Seat has ended."}</p>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{tabs.map(([id, l]) => <Chip key={id} active={tab === id} onClick={() => setTab(id)}>{l}</Chip>)}</div>

      {list.loading ? (
        <div role="status" aria-busy="true" aria-label="Loading questions" className="space-y-3">{[0, 1, 2].map((i) => <Sk key={i} className="h-24 w-full rounded-[22px]" />)}</div>
      ) : list.error && list.items.length === 0 ? (
        <Empty title="Couldn't load questions" body={list.error}><button type="button" onClick={list.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
      ) : list.items.length === 0 ? (
        <Empty title={tab === "open" ? "No questions yet" : tab === "answered" ? "Nothing answered yet" : "Nothing skipped"} body={tab === "open" && asking ? "Be the first to ask." : undefined} />
      ) : (
        list.items.map((e, i) => (
          <EntryCard key={e.id} code={code} e={e} animate="in" delay={Math.min(i, 6) * 40} show={show} reactField="upvotes_count"
            canReact={v.can_participate} onReact={(x) => void react(x, "upvotes_count")}
            onReport={v.is_member ? setReport : undefined} onRemove={v.can_moderate ? setRemove : undefined}
            actions={v.is_host && tab !== "answered" ? (
              <>
                <button type="button" onClick={() => { setAnswering(e.id); setDraft(""); }} className="font-bold text-brand">Answer</button>
                {tab === "open" ? <button type="button" onClick={() => void act(e, "skip")} className="hover:text-fg">Skip</button> : <button type="button" onClick={() => void act(e, "reopen")} className="hover:text-fg">Reopen</button>}
                <button type="button" onClick={() => void act(e, "dismiss")} className="hover:text-danger">Dismiss</button>
              </>
            ) : undefined}
            footer={answering === e.id ? (
              <div className="mt-3">
                <textarea className={`${AREA} min-h-[88px]`} autoFocus maxLength={1500} placeholder="Your answer" value={draft} onChange={(x) => setDraft(x.target.value)} />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setAnswering(null)} className={buttonClass("ghost", "h-10 px-4")}>Cancel</button>
                  <button type="button" disabled={!draft.trim()} onClick={() => void act(e, "answer", draft.trim())} className={buttonClass("primary", "h-10 px-5")}>Post answer</button>
                </div>
              </div>
            ) : undefined}
          />
        ))
      )}
      {list.cursor && <button type="button" onClick={() => void list.loadMore()} className={buttonClass("outline", "mx-auto h-10")}>Show more</button>}

      {report && <ReportSheet title="Report question" onClose={() => setReport(null)} onSubmit={(reason) => momentsApi.report(code, { entry_id: report.id, reason }).then(() => { show("Report sent"); })} />}
      {remove && <RemoveSheet code={code} entry={remove} onClose={() => setRemove(null)} onDone={(id) => { list.drop(id); reload(); }} />}
    </div>
  );
}
