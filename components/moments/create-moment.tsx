"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AREA, Chip, Label, Sheet, messageOf, useFetch } from "@/components/community/kit";
import { Group, Toggle } from "@/components/settings/settings-kit";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { communitiesApi, type Community, type CommunityDetail } from "@/lib/api/communities";
import { MOMENT_TYPES, momentsApi, type Moment, type MomentType } from "@/lib/api/moments";
import { TYPE_META, revealPresets, tint } from "@/lib/moments/meta";
import { TypeIcon, MomentShare } from "./kit";

type FormProps = { c: CommunityDetail; busy: boolean; err: string | null; onSubmit: (body: Record<string, unknown>) => void };

function Foot({ busy, err, disabled, label, onClick }: { busy: boolean; err: string | null; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <>
      {err && <p role="alert" className="mt-3 px-1 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={disabled || busy} onClick={onClick} className={buttonClass("primary", "mt-5 h-12 w-full")}>{busy ? "Creating…" : label}</button>
    </>
  );
}
function Dur<T extends number | null>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [string, T][] }) {
  return <div className="flex flex-wrap gap-2">{opts.map(([l, v]) => <Chip key={l} active={value === v} onClick={() => onChange(v)}>{l}</Chip>)}</div>;
}

function HotSeatForm({ busy, err, onSubmit }: FormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mins, setMins] = useState(30);
  const [anon, setAnon] = useState(false);
  const [anonQ, setAnonQ] = useState(true);
  return (
    <>
      <Label hint="Optional">What&apos;s it about?</Label>
      <input className={inputClass} maxLength={200} placeholder="Ask me anything about 200L" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label hint="Optional">A short intro</Label>
      <textarea className={`${AREA} min-h-[80px]`} maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} />
      <Label>Questions stay open for</Label>
      <Dur value={mins} onChange={setMins} opts={[["15 min", 15], ["30 min", 30], ["1 hour", 60], ["2 hours", 120]]} />
      <div className="mt-5"><Group>
        <Toggle icon="eyeClosed" label="Hide my identity" value={anon} onChange={setAnon} />
        <Toggle icon="message" label="Allow anonymous questions" value={anonQ} onChange={setAnonQ} />
      </Group></div>
      <Foot busy={busy} err={err} disabled={false} label="Take the seat" onClick={() => onSubmit({ title, body, duration_minutes: mins, anonymous: anon, allow_anonymous_entries: anonQ })} />
    </>
  );
}

function VerdictForm({ busy, err, onSubmit }: FormProps) {
  const [title, setTitle] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [hours, setHours] = useState(24);
  const [anon, setAnon] = useState(false);
  const filled = opts.map((o) => o.trim()).filter(Boolean);
  return (
    <>
      <Label>The question or dilemma</Label>
      <textarea className={`${AREA} min-h-[80px]`} maxLength={200} placeholder="Should lecturers mark attendance?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label hint="2 to 6">Options</Label>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={i} className="flex gap-2">
            <input className={`${inputClass} h-12`} maxLength={80} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpts((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
            {opts.length > 2 && <button type="button" aria-label="Remove option" onClick={() => setOpts((l) => l.filter((_, j) => j !== i))} className="h-12 shrink-0 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-muted">Remove</button>}
          </div>
        ))}
        {opts.length < 6 && <button type="button" onClick={() => setOpts((l) => [...l, ""])} className="h-10 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg">Add option</button>}
      </div>
      <Label>Voting closes in</Label>
      <Dur value={hours} onChange={setHours} opts={[["1 hour", 1], ["6 hours", 6], ["24 hours", 24], ["3 days", 72], ["7 days", 168]]} />
      <div className="mt-5"><Group><Toggle icon="eyeClosed" label="Hide my identity" value={anon} onChange={setAnon} /></Group></div>
      <Foot busy={busy} err={err} disabled={!title.trim() || filled.length < 2} label="Start the verdict" onClick={() => onSubmit({ title, options: filled, duration_hours: hours, anonymous: anon })} />
    </>
  );
}

function OneQuestionForm({ busy, err, onSubmit }: FormProps) {
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState<number | null>(null);
  const [anon, setAnon] = useState(false);
  return (
    <>
      <Label>Your question</Label>
      <textarea className={`${AREA} min-h-[96px]`} autoFocus maxLength={200} placeholder="Describe your department without mentioning its name." value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label hint="Optional">Deadline</Label>
      <Dur value={hours} onChange={setHours} opts={[["None", null], ["1 hour", 1], ["24 hours", 24], ["3 days", 72]]} />
      <div className="mt-5"><Group><Toggle icon="eyeClosed" label="Hide my identity" value={anon} onChange={setAnon} /></Group></div>
      <Foot busy={busy} err={err} disabled={!title.trim()} label="Ask it" onClick={() => onSubmit({ title, duration_hours: hours, anonymous: anon })} />
    </>
  );
}

function ConfessionForm({ busy, err, onSubmit }: FormProps) {
  const presets = revealPresets();
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(presets[Math.min(1, presets.length - 1)].value);
  const [mode, setMode] = useState("sequential");
  const [anon, setAnon] = useState(false);
  const when = new Date(at);
  return (
    <>
      <Label>Theme</Label>
      <input className={inputClass} maxLength={200} placeholder="Confession Night" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label>Reveal begins</Label>
      <div className="flex flex-wrap gap-2">{presets.map((p) => <Chip key={p.label} active={at === p.value} onClick={() => setAt(p.value)}>{p.label}</Chip>)}</div>
      <input type="datetime-local" className={`${inputClass} mt-2`} value={at} onChange={(e) => setAt(e.target.value)} />
      <Label>How should they appear?</Label>
      <div className="flex flex-wrap gap-2">{[["sequential", "One by one"], ["all", "All at once"], ["manual", "I'll reveal them"]].map(([id, l]) => <Chip key={id} active={mode === id} onClick={() => setMode(id)}>{l}</Chip>)}</div>
      <p className="mt-3 px-1 text-supporting leading-[1.4] text-muted">Submissions close when the reveal starts. Every confession is moderated before it can appear, and it runs on its own even if you close the app.</p>
      <div className="mt-4"><Group><Toggle icon="eyeClosed" label="Hide my identity" value={anon} onChange={setAnon} /></Group></div>
      <Foot busy={busy} err={err} disabled={!title.trim() || Number.isNaN(when.getTime())} label="Open submissions" onClick={() => onSubmit({ title, reveal_at: when.toISOString(), reveal_mode: mode, anonymous: anon })} />
    </>
  );
}

type Q = { prompt: string; choices: string[]; correct: number; accepted: string };
const blank = (): Q => ({ prompt: "", choices: ["", "", "", ""], correct: 0, accepted: "" });
const CT: [string, string][] = [["trivia", "Trivia"], ["riddle", "Riddle"], ["campus_knowledge", "Campus knowledge"], ["creative", "Creative response"], ["voting", "Voting contest"]];

function WarForm({ c, busy, err, onSubmit }: FormProps) {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Community[]>([]);
  const [target, setTarget] = useState<Community | null>(null);
  const [ctype, setCtype] = useState("trivia");
  const [qs, setQs] = useState<Q[]>([blank(), blank(), blank()]);
  const [mins, setMins] = useState(1440);
  const [message, setMessage] = useState("");
  const quiz = ["trivia", "riddle", "campus_knowledge"].includes(ctype);
  const term = search.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const t = window.setTimeout(() => {
      communitiesApi.discover({ search: term }).then((r) => setFound(r.items.filter((x) => x.id !== c.id).slice(0, 6))).catch(() => setFound([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [term, c.id]);
  const shown = term.length < 2 ? [] : found;
  const rep = c.can.moderate || c.my_designations.some((d) => ["class_rep", "course_rep", "dept_exec"].includes(d.kind));
  const setQ = (i: number, p: Partial<Q>) => setQs((l) => l.map((q, j) => (j === i ? { ...q, ...p } : q)));

  function build() {
    const items = quiz ? qs.map((q) => {
      if (ctype === "riddle") return { kind: "text", prompt: q.prompt, accepted: q.accepted.split(",").map((s) => s.trim()).filter(Boolean) };
      const pairs = q.choices.map((t, i) => ({ t: t.trim(), i })).filter((p) => p.t);
      return { kind: "choice", prompt: q.prompt, choices: pairs.map((p) => p.t), correct_idx: pairs.findIndex((p) => p.i === q.correct) };
    }) : undefined;
    onSubmit({ title, challenged: target?.slug, challenge_type: ctype, items, duration_minutes: mins, message });
  }
  return (
    <>
      <Label>Challenge title</Label>
      <input className={inputClass} maxLength={200} placeholder="ICE vs CSC: who knows campus best?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Label>Challenge which community?</Label>
      {target ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-interactive p-3">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-fg">{target.name}</span>
          <button type="button" onClick={() => setTarget(null)} className="text-secondary font-bold text-muted">Change</button>
        </div>
      ) : (
        <>
          <input className={inputClass} placeholder="Search communities" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-2 space-y-1.5">{shown.map((x) => <button key={x.id} type="button" onClick={() => setTarget(x)} className="w-full rounded-2xl bg-surface-interactive px-4 py-3 text-left text-[15px] font-semibold text-fg hover:bg-surface-elevated">{x.name}<span className="ml-2 text-supporting font-normal text-muted">{x.members_count} members</span></button>)}</div>
        </>
      )}
      <Label>Type of challenge</Label>
      <div className="flex flex-wrap gap-2">{CT.map(([id, l]) => <Chip key={id} active={ctype === id} onClick={() => setCtype(id)}>{l}</Chip>)}</div>
      {quiz && (
        <>
          <Label hint={ctype === "riddle" ? "Separate accepted answers with commas" : "Tap the dot to mark the right answer"}>Questions</Label>
          <div className="space-y-3">
            {qs.map((q, i) => (
              <div key={i} className="rounded-[20px] bg-surface-interactive/60 p-3">
                <input className={`${inputClass} h-12`} maxLength={300} placeholder={`Question ${i + 1}`} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} />
                {ctype === "riddle" ? (
                  <input className={`${inputClass} mt-2 h-12`} placeholder="Accepted answers" value={q.accepted} onChange={(e) => setQ(i, { accepted: e.target.value })} />
                ) : q.choices.map((ch, j) => (
                  <div key={j} className="mt-2 flex items-center gap-2">
                    <button type="button" aria-label="Mark correct" onClick={() => setQ(i, { correct: j })} className={`size-6 shrink-0 rounded-full ${q.correct === j ? "bg-brand" : "bg-surface-elevated"}`} />
                    <input className={`${inputClass} h-11`} maxLength={80} placeholder={`Choice ${j + 1}`} value={ch} onChange={(e) => setQ(i, { choices: q.choices.map((x, k) => (k === j ? e.target.value : x)) })} />
                  </div>
                ))}
                {qs.length > 3 && <button type="button" onClick={() => setQs((l) => l.filter((_, k) => k !== i))} className="mt-2 text-supporting font-bold text-muted">Remove question</button>}
              </div>
            ))}
            {qs.length < 10 && <button type="button" onClick={() => setQs((l) => [...l, blank()])} className="h-10 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg">Add question</button>}
          </div>
        </>
      )}
      <Label>Runs for</Label>
      <Dur value={mins} onChange={setMins} opts={[["1 hour", 60], ["3 hours", 180], ["24 hours", 1440], ["3 days", 4320]]} />
      <Label hint="Optional">A message to them</Label>
      <textarea className={`${AREA} min-h-[64px]`} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
      <p className="mt-3 px-1 text-supporting leading-[1.4] text-muted">{rep ? "As a representative, this goes out as an official challenge right away." : "A representative of your community has to approve it before the other side sees it."} The clock starts when both sides accept.</p>
      <Foot busy={busy} err={err} disabled={!title.trim() || !target} label="Send challenge" onClick={build} />
    </>
  );
}

export function MomentPicker({ c, onClose, onCreated }: { c: CommunityDetail; onClose: () => void; onCreated?: () => void }) {
  const [step, setStep] = useState<MomentType | null>(null);
  const [done, setDone] = useState<Moment | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const perm = useFetch(`mset:${c.id}`, () => momentsApi.settings(c.id), { persist: false });

  async function create(body: Record<string, unknown>) {
    if (!step) return;
    setBusy(true);
    setErr(null);
    try {
      const m = await momentsApi.create(c.id, { type: step, ...body });
      setDone(m);
      window.dispatchEvent(new Event("community:moments"));
      onCreated?.();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const pending = done.status === "draft";
    return (
      <>
        <MomentShare m={done} onClose={onClose} note={pending ? "Your challenge is created. It goes live once both communities' representatives accept." : "Share it in your class WhatsApp group. People open the link, sign in if they need to, and land right here."} />
        <div className="sr-only"><Link href={done.path}>Open</Link></div>
      </>
    );
  }
  if (step) {
    const F = { hot_seat: HotSeatForm, verdict: VerdictForm, one_question: OneQuestionForm, confession_drop: ConfessionForm, dept_war: WarForm }[step];
    return (
      <Sheet title={TYPE_META[step].title} onClose={onClose} wide>
        <button type="button" onClick={() => { setStep(null); setErr(null); }} className="mb-1 px-1 text-secondary font-bold text-muted">Back</button>
        <p className="px-1 text-secondary leading-[1.45] text-muted">{TYPE_META[step].blurb}</p>
        <F c={c} busy={busy} err={err} onSubmit={(b) => void create(b)} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Create a Moment" onClose={onClose} wide>
      <p className="px-1 pb-3 text-secondary leading-[1.45] text-muted">Something is about to happen in {c.name}. Pick what.</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {MOMENT_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const ok = perm.data ? perm.data.can[t] : true;
          return (
            <button key={t} type="button" disabled={!ok} onClick={() => setStep(t)} className={`flex items-start gap-3.5 rounded-[22px] p-4 text-left transition-transform active:scale-[0.98] disabled:opacity-45 ${t === "dept_war" ? "sm:col-span-2" : ""}`} style={{ background: tint(meta.color, 11) }}>
              <TypeIcon type={t} />
              <span className="min-w-0">
                <span className="block text-[16px] font-extrabold tracking-tight text-fg">{meta.title}</span>
                <span className="block text-supporting font-semibold" style={{ color: meta.color }}>{ok ? meta.tag : "Not enabled in this community"}</span>
                <span className="mt-1 block text-secondary leading-[1.35] text-muted">{meta.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
