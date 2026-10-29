"use client";

import { useState } from "react";
import { Empty, ReportSheet, messageOf } from "@/components/community/kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { cfgOf, momentsApi, newKey, type Entry, type VerdictCfg } from "@/lib/api/moments";
import { shareOutcome } from "@/lib/moments/outcome";
import { momentUrl, tint, TYPE_META } from "@/lib/moments/meta";
import { Composer, EntryCard, Gate, useEntryList, useReact, type ViewProps } from "./kit";
import { RemoveSheet } from "./moderation";

export function Verdict({ m, code, version, reload, patch, show }: ViewProps) {
  const v = m.viewer;
  const c = cfgOf<VerdictCfg>(m);
  const color = TYPE_META.verdict.color;
  const over = m.status === "completed" || m.status === "closed";
  const voted = c.my_vote !== null && c.my_vote !== undefined;
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [report, setReport] = useState<Entry | null>(null);
  const [remove, setRemove] = useState<Entry | null>(null);
  const showDiscussion = v.can_view && (voted || over);
  const list = useEntryList(code, {}, showDiscussion, version);
  const react = useReact(code, list.patchOne, show, v.can_comment, v.authenticated);

  async function vote() {
    if (sel === null || busy) return;
    setBusy(true);
    try {
      const r = await momentsApi.vote(code, sel);
      patch((d) => ({ ...d, config: r.config }));
      reload();
    } catch (e) {
      show(messageOf(e));
      reload();
    } finally {
      setBusy(false);
    }
  }
  async function post(body: string, anonymous: boolean) {
    setPosting(true);
    try {
      const r = await momentsApi.entry(code, { body, anonymous, client_key: newKey() });
      list.add(r.entry);
      return true;
    } catch (e) {
      show(messageOf(e));
      return false;
    } finally {
      setPosting(false);
    }
  }
  async function share() {
    const r = await shareOutcome({
      title: m.title ?? "Community Verdict", community: m.community.name, total: c.total_votes ?? 0, url: momentUrl(code),
      options: (c.options ?? []).map((o) => ({ label: o.label, pct: o.pct ?? 0 })),
    });
    if (r === "saved") show("Result card saved");
    else if (r === "failed") show("Couldn't create the card");
  }

  const top = Math.max(0, ...(c.options ?? []).map((o) => o.pct ?? 0));
  return (
    <div className="mt-4 space-y-4">
      {!c.results_visible ? (
        <div className="space-y-2">
          <p className="px-1 text-secondary text-muted">Vote to see how {m.community.name} voted. One vote per account, final once cast.</p>
          {(c.options ?? []).map((o) => (
            <button key={o.idx} type="button" disabled={!v.can_participate} onClick={() => setSel(o.idx)}
              className="w-full rounded-[20px] px-5 py-4 text-left text-[16px] font-bold text-fg transition-all active:scale-[0.99] disabled:opacity-60"
              style={{ background: sel === o.idx ? tint(color, 30) : "var(--color-surface-subtle, #19191d)", outline: sel === o.idx ? `2px solid ${color}` : "none" }}>
              {o.label}
            </button>
          ))}
          {v.can_participate ? (
            <button type="button" disabled={sel === null || busy} onClick={() => void vote()} className={buttonClass("primary", "h-12 w-full")}>{busy ? "Casting…" : "Lock in my vote"}</button>
          ) : <Gate m={m} onJoined={reload} />}
        </div>
      ) : (
        <div className="mo-in rounded-[24px] bg-surface-subtle p-5">
          <p className="text-micro font-bold uppercase tracking-[0.1em] text-muted">{over ? "Final result" : "Live result"} · {c.total_votes ?? 0} {(c.total_votes ?? 0) === 1 ? "vote" : "votes"}</p>
          <div className="mt-4 space-y-3.5">
            {(c.options ?? []).map((o) => {
              const lead = (o.pct ?? 0) === top && top > 0;
              return (
                <div key={o.idx}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-fg">{o.label}</span>
                    {c.my_vote === o.idx && <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-micro font-bold text-brand">Your vote</span>}
                    <span className="text-[15px] font-extrabold tabular-nums text-fg">{o.pct ?? 0}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-interactive">
                    <div className="mo-bar h-full rounded-full" style={{ width: `${o.pct ?? 0}%`, background: lead ? color : "#4a4a53" }} />
                  </div>
                </div>
              );
            })}
          </div>
          {over && <button type="button" onClick={() => void share()} className={buttonClass("outline", "mt-5 h-10 px-4")}><Icon name="share" className="size-4" />Share result card</button>}
        </div>
      )}

      {showDiscussion && (
        <>
          <p className="px-1 pt-2 text-[17px] font-extrabold tracking-tight text-fg">Discussion</p>
          {v.can_comment ? <Composer placeholder="Say why you voted that way" cta="Post" max={500} allowAnon={m.allow_anonymous_entries} busy={posting} onSend={post} /> : v.is_member ? null : <Gate m={m} onJoined={reload} />}
          {list.loading ? <Sk className="h-24 w-full rounded-[22px]" /> : list.items.length === 0 ? <Empty title="No comments yet" body="Start the discussion." /> : list.items.map((e) => (
            <EntryCard key={e.id} code={code} e={e} animate="in" show={show} reactField="reactions_count" canReact={v.can_comment} canReply={v.can_comment} allowAnon={m.allow_anonymous_entries}
              onReact={(x) => void react(x, "reactions_count")} onReport={v.is_member ? setReport : undefined} onRemove={v.can_moderate ? setRemove : undefined} />
          ))}
          {list.cursor && <button type="button" onClick={() => void list.loadMore()} className={buttonClass("outline", "mx-auto h-10")}>Show more</button>}
        </>
      )}
      {!showDiscussion && !voted && <p className="px-1 text-supporting text-muted">The discussion opens once you&apos;ve voted.</p>}
      {report && <ReportSheet title="Report comment" onClose={() => setReport(null)} onSubmit={(reason) => momentsApi.report(code, { entry_id: report.id, reason }).then(() => { show("Report sent"); })} />}
      {remove && <RemoveSheet code={code} entry={remove} onClose={() => setRemove(null)} onDone={(id) => { list.drop(id); reload(); }} />}
    </div>
  );
}
