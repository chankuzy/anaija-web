"use client";

import { useState } from "react";
import { Chip, Empty, messageOf } from "@/components/community/kit";
import { AREA } from "@/components/community/kit";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { cfgOf, momentsApi, newKey, type Entry, type WarCfg, type WarItem, type WarSide } from "@/lib/api/moments";
import { tint, TYPE_META } from "@/lib/moments/meta";
import { Composer, Countdown, EntryCard, useEntryList, type ViewProps } from "./kit";
import { RemoveSheet } from "./moderation";

const LABEL: Record<string, string> = { trivia: "Trivia", riddle: "Riddles", campus_knowledge: "Campus knowledge", creative: "Creative response", voting: "Voting contest" };
const QUIZ = ["trivia", "riddle", "campus_knowledge"];

function SideCard({ s, mine, winner, live, max }: { s: WarSide; mine: boolean; winner: boolean; live: boolean; max: number }) {
  const w = live && max > 0 && s.score !== null ? Math.round((s.score / max) * 100) : 0;
  return (
    <div className="flex-1 rounded-[22px] bg-surface-subtle p-4 text-center">
      <span className="mx-auto block w-fit"><Avatar url={s.community.avatar} name={s.community.name} size={56} /></span>
      <p className="mt-2.5 line-clamp-2 text-[15px] font-extrabold leading-[1.2] text-fg">{s.community.name}</p>
      <p className="mt-0.5 text-supporting text-muted">{s.community.members_count ?? 0} members</p>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {mine && <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-micro font-bold text-brand">Your side</span>}
        {winner && <span className="rounded-pill bg-brand px-2 py-0.5 text-micro font-extrabold text-brand-fg">Winner</span>}
        {s.status === "pending" && <span className="rounded-pill bg-surface-interactive px-2 py-0.5 text-micro font-bold text-muted">Awaiting</span>}
        {s.status === "declined" && <span className="rounded-pill bg-surface-interactive px-2 py-0.5 text-micro font-bold text-muted">Declined</span>}
      </div>
      {live && (
        <>
          <p className="mt-3 text-[28px] font-extrabold tabular-nums leading-none text-fg">{s.score ?? 0}</p>
          <div className="mx-auto mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-interactive"><div className="mo-bar h-full rounded-full" style={{ width: `${w}%`, background: TYPE_META.dept_war.color }} /></div>
          <p className="mt-2 text-supporting text-muted">{s.participants} fighting{s.eligible === false ? " · needs more people" : ""}</p>
        </>
      )}
    </div>
  );
}

function Quiz({ code, items, onDone, show }: { code: string; items: WarItem[]; onDone: () => void; show: (s: string) => void }) {
  const [local, setLocal] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const answered = items.filter((i) => i.answered || local.includes(i.idx)).length;
  const next = items.find((i) => !i.answered && !local.includes(i.idx));
  async function submit(body: { choice_idx?: number; text?: string }) {
    if (!next || busy) return;
    setBusy(true);
    try {
      await momentsApi.warAnswer(code, { idx: next.idx, ...body });
      setLocal((l) => [...l, next.idx]);
      setText("");
      onDone();
    } catch (e) {
      const msg = messageOf(e);
      if (/already answered/i.test(msg)) setLocal((l) => [...l, next.idx]);
      else show(msg);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mo-in rounded-[24px] bg-surface-subtle p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-interactive"><div className="mo-bar h-full rounded-full bg-brand" style={{ width: `${items.length ? (answered / items.length) * 100 : 0}%` }} /></div>
        <span className="text-supporting font-bold tabular-nums text-muted">{answered}/{items.length}</span>
      </div>
      {!next ? (
        <p className="py-6 text-center text-[15px] font-bold text-fg">You&apos;re done. Results appear when the war ends.</p>
      ) : (
        <>
          <p className="text-[18px] font-bold leading-[1.3] text-fg">{next.prompt}</p>
          {next.kind === "choice" ? (
            <div className="mt-4 space-y-2">
              {(next.choices ?? []).map((c, i) => (
                <button key={i} type="button" disabled={busy} onClick={() => void submit({ choice_idx: i })} className="w-full rounded-2xl bg-surface-interactive px-4 py-3.5 text-left text-[15px] font-semibold text-fg transition-transform active:scale-[0.99] disabled:opacity-60">{c}</button>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <input className={`${inputClass} h-12 flex-1`} maxLength={120} placeholder="Your answer" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) void submit({ text: text.trim() }); }} />
              <button type="button" disabled={!text.trim() || busy} onClick={() => void submit({ text: text.trim() })} className={buttonClass("primary", "h-12 px-5")}>Submit</button>
            </div>
          )}
          <p className="mt-3 text-supporting text-muted">Answers are final. Correct answers are revealed when the war ends.</p>
        </>
      )}
    </div>
  );
}

function Submissions({ m, code, cfg, version, reload, show }: ViewProps & { cfg: WarCfg }) {
  const v = m.viewer;
  const list = useEntryList(code, {}, v.can_view, version, "war");
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState(false);
  const [remove, setRemove] = useState<Entry | null>(null);
  const name = (id?: number | null) => cfg.sides.find((s) => s.community.id === id)?.community.name ?? "";
  const open = m.status === "active" && cfg.my_side !== null;
  async function send(body: string, anonymous: boolean) {
    setBusy(true);
    try {
      const e = await momentsApi.warSubmit(code, { body, anonymous, client_key: newKey() });
      list.add(e);
      setEntered(true);
      reload();
      return true;
    } catch (err) {
      show(messageOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function vote(e: Entry) {
    const was = e.my_reaction !== null;
    list.patchOne(e.id, { my_reaction: was ? null : "upvote", upvotes_count: Math.max(0, e.upvotes_count + (was ? -1 : 1)) });
    try {
      const r = await momentsApi.warVote(code, e.id);
      list.patchOne(e.id, { my_reaction: r.my_reaction, upvotes_count: r.count });
    } catch (err) {
      list.patchOne(e.id, { my_reaction: e.my_reaction, upvotes_count: e.upvotes_count });
      show(messageOf(err));
    }
  }
  return (
    <div className="space-y-3">
      {open && v.my_entries === 0 && !entered && (
        <Composer placeholder="Your entry for your side" cta="Enter" max={600} allowAnon={m.allow_anonymous_entries} busy={busy} onSend={send} hint="One entry each. The other community votes on it." />
      )}
      <p className="px-1 text-supporting text-muted">You can only vote on the other side&apos;s entries.</p>
      {list.loading ? <Sk className="h-24 w-full rounded-[22px]" /> : list.items.length === 0 ? <Empty title="No entries yet" /> : list.items.map((e) => {
        const theirs = e.side_community_id !== cfg.my_side;
        return (
          <EntryCard key={e.id} code={code} e={e} animate="in" show={show} canReact={false} reactField="upvotes_count"
            reactSlot={
              <span className="inline-flex items-center gap-3">
                <span className="rounded-pill bg-surface-interactive px-2.5 py-1 text-micro font-bold text-fg">{name(e.side_community_id)}</span>
                <button type="button" disabled={!open || !theirs} onClick={() => void vote(e)} className={`inline-flex items-center gap-1.5 disabled:opacity-50 ${e.my_reaction ? "text-like" : "hover:text-fg"}`}>
                  <Icon name="heart" filled={!!e.my_reaction} className="size-[18px]" />{e.upvotes_count}
                </button>
              </span>
            }
            onRemove={v.can_moderate || v.is_staff ? setRemove : undefined} />
        );
      })}
      {list.cursor && <button type="button" onClick={() => void list.loadMore()} className={buttonClass("outline", "mx-auto h-10")}>Show more</button>}
      {remove && <RemoveSheet code={code} entry={remove} war onClose={() => setRemove(null)} onDone={(id) => list.drop(id)} />}
    </div>
  );
}

export function DeptWar(props: ViewProps) {
  const { m, code, reload, show } = props;
  const v = m.viewer;
  const cfg = cfgOf<WarCfg>(m);
  const [busy, setBusy] = useState(false);
  const sides = cfg.sides ?? [];
  const ch = sides.find((s) => s.side === "challenger");
  const cd = sides.find((s) => s.side === "challenged");
  const live = m.status === "active" || m.status === "completed";
  const done = m.status === "completed";
  const ctype = cfg.challenge_type ?? "";
  const quiz = QUIZ.includes(ctype);
  const max = Math.max(0, ...sides.map((s) => s.score ?? 0));
  const winner = cfg.winner_community_id;
  const colour = TYPE_META.dept_war.color;

  async function respond(action: "accept" | "decline") {
    setBusy(true);
    try {
      const r = await momentsApi.warRespond(code, action);
      show(action === "decline" ? "Declined" : r.status === "active" ? "The war is on" : "Accepted");
      reload();
    } catch (e) {
      show(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function join(id: number) {
    setBusy(true);
    try {
      await momentsApi.warJoin(code, id);
      reload();
    } catch (e) {
      show(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  let waiting = "Waiting for a response.";
  if (ch?.status === "pending") waiting = `Waiting for an authorised representative of ${ch.community.name} to approve this challenge.`;
  else if (cd?.status === "pending") waiting = `Waiting for a representative of ${cd.community.name} to accept.`;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-stretch gap-2">
        {ch && <SideCard s={ch} mine={cfg.my_side === ch.community.id} winner={done && winner === ch.community.id} live={live} max={max} />}
        <span className="grid place-items-center text-[13px] font-extrabold tracking-widest text-muted">VS</span>
        {cd && <SideCard s={cd} mine={cfg.my_side === cd.community.id} winner={done && winner === cd.community.id} live={live} max={max} />}
      </div>
      <p className="px-1 text-center text-secondary text-muted">{LABEL[ctype] ?? "Challenge"}{cfg.duration_minutes ? ` · ${cfg.duration_minutes >= 1440 ? `${Math.round(cfg.duration_minutes / 1440)}d` : cfg.duration_minutes >= 60 ? `${Math.round(cfg.duration_minutes / 60)}h` : `${cfg.duration_minutes}m`}` : ""}{cfg.points_per_item && quiz ? ` · ${cfg.points_per_item} pts per question, averaged per participant` : ""}</p>

      {m.status === "draft" && (
        <div className="mo-in rounded-[24px] p-5" style={{ background: tint(colour, 12) }}>
          {cfg.message && <p className="mb-3 text-[15px] italic leading-[1.45] text-fg">“{cfg.message}”</p>}
          <p className="text-[15px] font-bold text-fg">{(cfg.can_respond ?? []).length ? "Your community is being asked to respond." : waiting}</p>
          {cfg.invite_expires_at && <div className="mt-3"><Countdown to={cfg.invite_expires_at} label="Challenge expires in" onDone={reload} /></div>}
          {(cfg.can_respond ?? []).length > 0 && (
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void respond("accept")} className={buttonClass("primary", "h-11 px-6")}>Accept</button>
              <button type="button" disabled={busy} onClick={() => void respond("decline")} className={buttonClass("outline", "h-11 px-6")}>Decline</button>
            </div>
          )}
          <p className="mt-3 text-supporting leading-[1.4] text-muted">Only authorised representatives can commit a community to an official challenge.</p>
        </div>
      )}

      {m.status === "active" && m.ends_at && <div className="rounded-2xl bg-surface-subtle px-4 py-3"><Countdown to={m.ends_at} label="Ends in" onDone={reload} /></div>}

      {done && (
        <div className="mo-in rounded-[24px] p-5 text-center" style={{ background: tint(colour, 14) }}>
          <p className="text-micro font-bold uppercase tracking-[0.1em] text-muted">Final result</p>
          <p className="mt-1.5 text-[22px] font-extrabold tracking-tight text-fg">
            {winner ? `${sides.find((s) => s.community.id === winner)?.community.name ?? "A community"} wins` : (cfg.results ?? []).some((r) => r.eligible) ? "It's a draw" : `Not enough people took part (${cfg.min_participants ?? 3} needed per side)`}
          </p>
        </div>
      )}

      {m.status === "active" && cfg.my_side === null && (
        (cfg.can_join ?? []).length > 0 ? (
          <div className="rounded-[22px] bg-surface-subtle p-4">
            <p className="text-[15px] font-bold text-fg">Pick your side</p>
            <p className="mt-1 text-secondary text-muted">You fight for one community and can&apos;t switch.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(cfg.can_join ?? []).map((id) => <button key={id} type="button" disabled={busy} onClick={() => void join(id)} className={buttonClass("primary", "h-11 px-5")}>Fight for {sides.find((s) => s.community.id === id)?.community.name}</button>)}
            </div>
          </div>
        ) : !v.authenticated ? (
          <a href={`/login?next=${encodeURIComponent(`/m/${code}`)}`} className={buttonClass("primary", "h-11 w-full")}>Sign in to take part</a>
        ) : <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-secondary text-muted">Only members of {ch?.community.name} or {cd?.community.name} can take part. You can watch the scores live.</p>
      )}

      {m.status === "active" && cfg.my_side !== null && quiz && <Quiz code={code} items={cfg.items ?? []} onDone={reload} show={show} />}
      {live && !quiz && ctype && <Submissions {...props} cfg={cfg} />}

      {done && quiz && (cfg.items ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="px-1 pt-2 text-[17px] font-extrabold tracking-tight text-fg">The answers</p>
          {cfg.items.map((i) => (
            <div key={i.idx} className="rounded-[20px] bg-surface-subtle p-4">
              <p className="text-[15px] font-bold leading-[1.3] text-fg">{i.prompt}</p>
              <p className="mt-1.5 text-secondary font-semibold text-brand">{i.kind === "choice" ? i.choices?.[i.correct_idx ?? 0] : (i.accepted ?? []).join(" / ")}</p>
              {i.my_correct !== null && i.my_correct !== undefined && <p className="mt-1 text-supporting text-muted">{i.my_correct ? "You got it right" : "You missed this one"}</p>}
            </div>
          ))}
        </div>
      )}
      <textarea hidden className={AREA} readOnly aria-hidden="true" tabIndex={-1} />
      <Chip active={false} onClick={() => {}} disabled>{""}</Chip>
    </div>
  );
}
