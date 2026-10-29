"use client";

import { useEffect, useRef, useState } from "react";
import { Chip, Empty, ReportSheet, messageOf, shareLink } from "@/components/community/kit";
import { buttonClass } from "@/components/ui/button";
import { Sk } from "@/components/ui/skeleton";
import { momentsApi, newKey, type Entry } from "@/lib/api/moments";
import { momentUrl } from "@/lib/moments/meta";
import { Composer, EntryCard, Gate, useEntryList, useReact, type ViewProps } from "./kit";
import { RemoveSheet } from "./moderation";

export function OneQuestion({ m, code, version, reload, show }: ViewProps) {
  const v = m.viewer;
  const [sort, setSort] = useState<"latest" | "top">("latest");
  const list = useEntryList(code, { sort: sort === "top" ? "top" : undefined }, v.can_view, version);
  const react = useReact(code, list.patchOne, show, v.can_participate, v.authenticated);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Entry | null>(null);
  const [remove, setRemove] = useState<Entry | null>(null);
  const jumped = useRef(false);

  // A shared response link (#r123) scrolls to that response once it is on screen.
  const n = list.items.length;
  useEffect(() => {
    if (jumped.current || n === 0 || !/^#r\d+$/.test(window.location.hash)) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) {
      jumped.current = true;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [n]);

  async function send(body: string, anonymous: boolean) {
    setBusy(true);
    try {
      const r = await momentsApi.entry(code, { body, anonymous, client_key: newKey() });
      if (sort === "latest") list.add(r.entry);
      show("Your answer is in");
      reload();
      return true;
    } catch (e) {
      show(messageOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function shareOne(e: Entry) {
    const r = await shareLink(`${momentUrl(code)}#r${e.id}`, `“${e.body.slice(0, 120)}” · ${m.title ?? "One Question"}`);
    if (r === "copied") show("Link copied");
  }

  return (
    <div className="mt-4 space-y-3">
      {m.status === "active" ? (v.can_participate ? (
        <Composer placeholder="Your answer" cta="Answer" max={800} allowAnon={m.allow_anonymous_entries} busy={busy} onSend={send} hint="Up to 5 answers each." />
      ) : <Gate m={m} onJoined={reload} />) : <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-secondary text-muted">This question is closed. You can still read every answer.</p>}

      <div className="flex gap-2">
        <Chip active={sort === "latest"} onClick={() => setSort("latest")}>Latest</Chip>
        <Chip active={sort === "top"} onClick={() => setSort("top")}>Most liked</Chip>
        <span className="ml-auto self-center text-supporting text-muted">{m.entries_count} {m.entries_count === 1 ? "answer" : "answers"}</span>
      </div>

      {list.loading ? (
        <div role="status" aria-busy="true" aria-label="Loading answers" className="space-y-3">{[0, 1, 2].map((i) => <Sk key={i} className="h-28 w-full rounded-[22px]" />)}</div>
      ) : list.error && list.items.length === 0 ? (
        <Empty title="Couldn't load answers" body={list.error}><button type="button" onClick={list.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
      ) : list.items.length === 0 ? (
        <Empty title="No answers yet" body={v.can_participate ? "Be the first to answer." : undefined} />
      ) : (
        list.items.map((e, i) => (
          <EntryCard key={e.id} code={code} e={e} big={e.body.length < 140} animate="in" delay={Math.min(i, 6) * 40} show={show} reactField="reactions_count"
            canReact={v.can_participate} onReact={(x) => void react(x, "reactions_count")} onShare={(x) => void shareOne(x)}
            onReport={v.is_member ? setReport : undefined} onRemove={v.can_moderate ? setRemove : undefined} />
        ))
      )}
      {list.cursor && <button type="button" onClick={() => void list.loadMore()} className={buttonClass("outline", "mx-auto h-10")}>Show more</button>}
      {report && <ReportSheet title="Report answer" onClose={() => setReport(null)} onSubmit={(reason) => momentsApi.report(code, { entry_id: report.id, reason }).then(() => { show("Report sent"); })} />}
      {remove && <RemoveSheet code={code} entry={remove} onClose={() => setRemove(null)} onDone={(id) => { list.drop(id); reload(); }} />}
    </div>
  );
}
