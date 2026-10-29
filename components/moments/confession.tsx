"use client";

import { memo, useState } from "react";
import { Empty, ReportSheet, messageOf, shareLink } from "@/components/community/kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { cfgOf, momentsApi, newKey, type ConfessionCfg, type Entry, type Moment } from "@/lib/api/moments";
import { useInterval } from "@/lib/messaging/use-interval";
import { fmtWhen, momentUrl, tint, TYPE_META, useNow } from "@/lib/moments/meta";
import { Composer, Countdown, EntryCard, Gate, useEntryList, useReact, type ViewProps } from "./kit";
import { QueueSheet, RemoveSheet } from "./moderation";

const RevealList = memo(function RevealList({ m, code, version, show }: { m: Moment; code: string; version: number; show: (s: string) => void }) {
  const v = m.viewer;
  const list = useEntryList(code, {}, v.can_view, version);
  const react = useReact(code, list.patchOne, show, v.can_comment, v.authenticated);
  const [report, setReport] = useState<Entry | null>(null);
  const [remove, setRemove] = useState<Entry | null>(null);
  async function shareOne(e: Entry) {
    const r = await shareLink(`${momentUrl(code)}#r${e.id}`, `A confession from ${m.community.name}`);
    if (r === "copied") show("Link copied");
  }
  if (list.loading) return <div role="status" aria-busy="true" aria-label="Loading confessions" className="space-y-3">{[0, 1].map((i) => <Sk key={i} className="h-28 w-full rounded-[22px]" />)}</div>;
  if (list.items.length === 0) return <Empty title="Nothing revealed yet" body="Confessions appear here as they are revealed." />;
  return (
    <div className="space-y-3">
      {list.items.map((e, i) => (
        <EntryCard key={e.id} code={code} e={e} big animate="reveal" delay={Math.min(i, 5) * 70} show={show} reactField="reactions_count" canReact={v.can_comment}
          canReply={v.can_comment} onReact={(x) => void react(x, "reactions_count")} onShare={(x) => void shareOne(x)}
          onReport={v.is_member ? setReport : undefined} onRemove={v.can_moderate ? setRemove : undefined} />
      ))}
      {list.cursor && <button type="button" onClick={() => void list.loadMore()} className={buttonClass("outline", "mx-auto h-10")}>Show older</button>}
      {report && <ReportSheet title="Report confession" onClose={() => setReport(null)} onSubmit={(reason) => momentsApi.report(code, { entry_id: report.id, reason }).then(() => { show("Report sent"); })} />}
      {remove && <RemoveSheet code={code} entry={remove} onClose={() => setRemove(null)} onDone={(id) => list.drop(id)} />}
    </div>
  );
});

export function Confession({ m, code, version, reload, show }: ViewProps) {
  const v = m.viewer;
  const c = cfgOf<ConfessionCfg>(m);
  const color = TYPE_META.confession_drop.color;
  const now = useNow();
  const revealAt = c.reveal_at ? Date.parse(c.reveal_at) : 0;
  const started = m.status === "completed" || (m.status === "closed" && now > 0 && now >= revealAt);
  const approved = c.approved_count ?? 0;
  const revealed = c.revealed_count ?? 0;
  const polling = m.status === "closed" && started && revealed < approved && c.reveal_mode !== "manual";
  const [tick, setTick] = useState(0);
  useInterval(() => { reload(); setTick((t) => t + 1); }, Math.min(30, Math.max(5, c.reveal_interval_secs ?? 20)) * 1000, polling);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState(false);
  const max = c.max_per_user ?? 3;

  async function send(body: string) {
    setBusy(true);
    try {
      await momentsApi.entry(code, { body, anonymous: true, client_key: newKey() });
      show("Submitted. It will be reviewed before the reveal.");
      reload();
      return true;
    } catch (e) {
      show(messageOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function manual(body: { count?: number; all?: boolean }) {
    try {
      const r = await momentsApi.reveal(code, body);
      show(r.revealed ? `Revealed ${r.revealed}` : "Nothing left to reveal");
      reload();
    } catch (e) {
      show(messageOf(e));
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {v.can_moderate && ["active", "closed"].includes(m.status) && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setQueue(true)} className={buttonClass("outline", "h-10 px-4")}>Review queue</button>
          {c.reveal_mode === "manual" && started && m.status === "closed" && (
            <>
              <button type="button" onClick={() => void manual({ count: 1 })} className={buttonClass("primary", "h-10 px-4")}>Reveal next</button>
              <button type="button" onClick={() => void manual({ count: 5 })} className={buttonClass("outline", "h-10 px-4")}>Reveal 5</button>
              <button type="button" onClick={() => void manual({ all: true })} className={buttonClass("outline", "h-10 px-4")}>Reveal all</button>
            </>
          )}
        </div>
      )}

      {m.status === "active" && (
        <>
          <div className="mo-in rounded-[24px] p-5" style={{ background: tint(color, 12) }}>
            {c.reveal_at && <Countdown to={c.reveal_at} label="Reveal in" big onDone={reload} />}
            {c.reveal_at && <p className="mt-2 text-center text-secondary text-muted">Reveals {fmtWhen(c.reveal_at)}</p>}
          </div>
          <div className="rounded-[20px] bg-surface-subtle p-4 text-secondary leading-[1.5] text-muted">
            <p className="font-bold text-fg">How it works</p>
            <p className="mt-1">Submit anonymously. Moderators review everything before it can be revealed. Confessions that name or accuse real people, or share private details, are rejected.</p>
          </div>
          {v.can_participate ? (
            v.my_entries >= max ? <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-secondary text-muted">You&apos;ve sent {v.my_entries} of {max}. Come back for the reveal.</p> : (
              <Composer placeholder="Your confession. No names, no phone numbers." cta="Submit anonymously" max={1200} allowAnon forceAnon busy={busy} onSend={send}
                hint={`${v.my_entries} of ${max} submitted. Always anonymous.`} />
            )
          ) : <Gate m={m} onJoined={reload} />}
        </>
      )}

      {m.status === "closed" && !started && c.reveal_at && (
        <div className="mo-in rounded-[24px] p-8" style={{ background: tint(color, 12) }}>
          <Countdown to={c.reveal_at} label="The reveal begins in" big onDone={reload} />
          <p className="mt-3 text-center text-secondary text-muted">{approved} {approved === 1 ? "confession is" : "confessions are"} ready · {fmtWhen(c.reveal_at)}</p>
        </div>
      )}

      {started && (
        <>
          {m.status === "closed" && (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-subtle px-4 py-3">
              <Icon name="eyeClosed" className="size-5" />
              <p className="text-secondary font-semibold text-fg">{revealed} of {approved} revealed{polling ? " · live" : ""}</p>
            </div>
          )}
          {m.status === "completed" && <p className="px-1 text-[17px] font-extrabold tracking-tight text-fg">Archive</p>}
          <RevealList m={m} code={code} version={version + tick} show={show} />
        </>
      )}

      {queue && <QueueSheet code={code} onClose={() => setQueue(false)} onChanged={reload} />}
    </div>
  );
}
