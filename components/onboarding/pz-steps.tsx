"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import type { OfferKind, PersonalizationSave, PersonalizationState, SkillStance, TaxSkill, Visibility } from "@/lib/api/personalization";
import { GHOST } from "./frame";

export interface StepProps {
  pz: PersonalizationState;
  busy: boolean;
  err: string | null;
  onSave: (s: PersonalizationSave) => void;
  onSkip: () => void;
}

const LABEL = "px-1 pb-2 pt-6 text-micro font-semibold uppercase tracking-[0.08em] text-muted";
const NOTE = "mt-4 px-1 text-supporting leading-[1.45] text-muted";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-10 rounded-full px-4 text-[14px] transition-colors ${on ? "bg-brand font-extrabold text-brand-fg" : "bg-card font-semibold text-fg hover:bg-card-elevated"}`}
    >
      {children}
    </button>
  );
}

function Footer({ can, busy, err, onContinue, onSkip, extra }: { can: boolean; busy: boolean; err: string | null; onContinue: () => void; onSkip: () => void; extra?: ReactNode }) {
  return (
    <div className="mt-auto flex flex-col gap-1 pt-8">
      {err && <p role="alert" className="pb-3 text-center text-secondary text-danger">{err}</p>}
      <Button disabled={!can || busy} onClick={onContinue} className="h-14 w-full">{busy ? "Saving…" : "Continue"}</Button>
      <button type="button" disabled={busy} onClick={onSkip} className={GHOST}>Skip for now</button>
      {extra}
    </div>
  );
}

const VIS: { v: Visibility; l: string }[] = [
  { v: "public", l: "Public" },
  { v: "campus", l: "My campus" },
  { v: "private", l: "Only me" },
];
function VisPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <div role="radiogroup" aria-label="Who can see this" className="flex gap-1 rounded-full bg-card p-1">
      {VIS.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`h-10 flex-1 rounded-full text-[14px] transition-colors ${value === o.v ? "bg-fg font-extrabold text-bg" : "font-semibold text-muted hover:text-fg"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function InterestsStep({ pz, busy, err, onSave, onSkip, onSkipAll }: StepProps & { onSkipAll?: () => void }) {
  const initial = pz.profile.interests;
  const [sel, setSel] = useState<number[]>(initial);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {pz.taxonomy.interests.map((i) => <Chip key={i.id} on={sel.includes(i.id)} onClick={() => toggle(i.id)}>{i.label}</Chip>)}
      </div>
      <p className={NOTE}>What you pick here is yours to change any time. It is kept separate from what we learn from your activity.</p>
      <Footer
        can={sel.length > 0 || initial.length > 0}
        busy={busy}
        err={err}
        onContinue={() => onSave({ interests: sel })}
        onSkip={onSkip}
        extra={onSkipAll && <button type="button" disabled={busy} onClick={onSkipAll} className={GHOST}>Skip personalization</button>}
      />
    </>
  );
}

type Row = { key: string; skill_id: number | null; label: string; stances: SkillStance[] };
const STANCES: { v: SkillStance; l: string }[] = [
  { v: "learning", l: "Learning" },
  { v: "practising", l: "Practising" },
  { v: "offering", l: "Offering to others" },
  { v: "want_to_learn", l: "Want to learn" },
];

export function SkillsStep({ pz, busy, err, onSave, onSkip }: StepProps) {
  const [rows, setRows] = useState<Row[]>(() => {
    const m = new Map<number, Row>();
    for (const s of pz.profile.skills) {
      const r = m.get(s.skill_id) ?? { key: String(s.skill_id), skill_id: s.skill_id, label: s.label, stances: [] };
      r.stances.push(s.stance);
      m.set(s.skill_id, r);
    }
    return [...m.values()];
  });
  const [vis, setVis] = useState<Visibility>(pz.profile.skills[0]?.visibility ?? "public");
  const [text, setText] = useState("");

  const toggleCurated = (sk: TaxSkill) =>
    setRows((rs) => (rs.some((r) => r.skill_id === sk.id) ? rs.filter((r) => r.skill_id !== sk.id) : [...rs, { key: String(sk.id), skill_id: sk.id, label: sk.label, stances: [] }]));

  function addCustom() {
    const label = text.replace(/\s+/g, " ").trim().slice(0, 60);
    if (label.length < 2 || rows.length >= 40) return;
    setText("");
    const known = pz.taxonomy.skills.find((s) => s.label.toLowerCase() === label.toLowerCase());
    if (known) return setRows((rs) => (rs.some((r) => r.skill_id === known.id) ? rs : [...rs, { key: String(known.id), skill_id: known.id, label: known.label, stances: [] }]));
    const key = `c:${label.toLowerCase()}`;
    setRows((rs) => (rs.some((r) => r.key === key) ? rs : [...rs, { key, skill_id: null, label, stances: [] }]));
  }

  const setStance = (key: string, st: SkillStance) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, stances: r.stances.includes(st) ? r.stances.filter((x) => x !== st) : [...r.stances, st] } : r)));

  const ready = rows.filter((r) => r.stances.length > 0);
  const pending = rows.length - ready.length;
  const save = () =>
    onSave({
      skills: ready.flatMap((r) =>
        r.stances.map((stance) => (r.skill_id ? { skill_id: r.skill_id, stance, visibility: vis } : { label: r.label, stance, visibility: vis })),
      ),
    });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {pz.taxonomy.skills.map((s) => <Chip key={s.id} on={rows.some((r) => r.skill_id === s.id)} onClick={() => toggleCurated(s)}>{s.label}</Chip>)}
      </div>
      <div className="mt-3 flex gap-2">
        <input className={inputClass} value={text} maxLength={60} placeholder="Something else? Type a skill" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <button type="button" onClick={addCustom} disabled={text.trim().length < 2} className="h-14 shrink-0 rounded-full bg-fg px-5 text-[14px] font-extrabold text-bg disabled:opacity-40">Add</button>
      </div>

      {rows.length > 0 && (
        <>
          <p className={LABEL}>How do you relate to each?</p>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key} className="rounded-2xl bg-card p-3.5">
                <p className="text-[15px] font-bold text-fg">{r.label}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {STANCES.map((st) => <Chip key={st.v} on={r.stances.includes(st.v)} onClick={() => setStance(r.key, st.v)}>{st.l}</Chip>)}
                </div>
              </li>
            ))}
          </ul>
          {pending > 0 && <p className={NOTE}>{pending === 1 ? "One skill has" : `${pending} skills have`} no choice yet and won&apos;t be saved.</p>}
          <p className={LABEL}>Who can see your skills</p>
          <VisPicker value={vis} onChange={setVis} />
          <p className={NOTE}>&ldquo;Offering&rdquo; is what you say you can do. It is shown as your own claim, never as verified.</p>
        </>
      )}
      <Footer can={ready.length > 0 || pz.profile.skills.length > 0} busy={busy} err={err} onContinue={save} onSkip={onSkip} />
    </>
  );
}

export function GoalsStep({ pz, busy, err, onSave, onSkip }: StepProps) {
  const initial = pz.profile.seeking;
  const [sel, setSel] = useState<number[]>(initial);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {pz.taxonomy.seek_kinds.map((k) => <Chip key={k.id} on={sel.includes(k.id)} onClick={() => toggle(k.id)}>{k.label}</Chip>)}
      </div>
      <p className={NOTE}>Pick as many as fit. Goals help us match you to people and opportunities, and nothing is shared without you choosing it.</p>
      <Footer can={sel.length > 0 || initial.length > 0} busy={busy} err={err} onContinue={() => onSave({ seeking: sel })} onSkip={onSkip} />
    </>
  );
}

type Draft = { id?: number; kind: OfferKind; title: string; description: string | null; skill_id: number | null; visibility: Visibility };
const KINDS: { v: OfferKind; l: string }[] = [
  { v: "service", l: "Service" },
  { v: "product", l: "Product" },
  { v: "project", l: "Project" },
  { v: "teach", l: "Teaching or mentoring" },
  { v: "collaborate", l: "Collaboration" },
  { v: "business", l: "Business" },
];

export function OffersStep({ pz, busy, err, onSave, onSkip }: StepProps) {
  const [list, setList] = useState<Draft[]>(() =>
    pz.profile.offers.map((o) => ({ id: o.id, kind: o.kind, title: o.title, description: o.description, skill_id: o.skill_id, visibility: o.visibility })),
  );
  const [kind, setKind] = useState<OfferKind | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [vis, setVis] = useState<Visibility>("public");

  const draft = (): Draft | null =>
    kind && title.trim().length >= 3 ? { kind, title: title.trim().slice(0, 80), description: desc.trim().slice(0, 500) || null, skill_id: null, visibility: vis } : null;

  function add() {
    const d = draft();
    if (!d || list.length >= 10) return;
    setList((l) => [...l, d]);
    setKind(null);
    setTitle("");
    setDesc("");
  }

  function save() {
    const d = draft();
    const all = d && list.length < 10 ? [...list, d] : list;
    onSave({
      offers: all.map((o) => ({
        ...(o.id ? { id: o.id } : {}),
        kind: o.kind,
        title: o.title,
        ...(o.description ? { description: o.description } : {}),
        ...(o.skill_id ? { skill_id: o.skill_id } : {}),
        visibility: o.visibility,
      })),
    });
  }

  return (
    <>
      {list.length > 0 && (
        <ul className="mb-2 space-y-2.5">
          {list.map((o, k) => (
            <li key={o.id ?? `n${k}`} className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-fg">{o.title}</span>
                <span className="block text-supporting text-muted">{KINDS.find((x) => x.v === o.kind)?.l}</span>
              </span>
              <button type="button" onClick={() => setList((l) => l.filter((_, i) => i !== k))} className="text-secondary font-bold text-muted hover:text-fg">Remove</button>
            </li>
          ))}
        </ul>
      )}

      {list.length < 10 && (
        <>
          <p className={LABEL}>{list.length ? "Add another" : "What do you offer?"}</p>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((o) => <Chip key={o.v} on={kind === o.v} onClick={() => setKind(kind === o.v ? null : o.v)}>{o.l}</Chip>)}
          </div>
          {kind && (
            <div className="mt-3 space-y-2.5">
              <input className={inputClass} value={title} maxLength={80} placeholder="Title, e.g. Logo design for student brands" onChange={(e) => setTitle(e.target.value)} />
              <input className={inputClass} value={desc} maxLength={500} placeholder="A line about it (optional)" onChange={(e) => setDesc(e.target.value)} />
              <p className={LABEL}>Who can see it</p>
              <VisPicker value={vis} onChange={setVis} />
              <button type="button" onClick={add} disabled={!draft()} className="mt-3 h-11 rounded-full bg-fg px-5 text-[14px] font-extrabold text-bg disabled:opacity-40">Add offer</button>
            </div>
          )}
        </>
      )}
      <p className={NOTE}>Offers are your own description of what you do. Anaija doesn&apos;t verify them.</p>
      <Footer can={list.length > 0 || !!draft() || pz.profile.offers.length > 0} busy={busy} err={err} onContinue={save} onSkip={onSkip} />
    </>
  );
}
