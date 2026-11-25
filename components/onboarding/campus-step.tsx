"use client";

import { useEffect, useMemo, useState } from "react";
import { messageOf } from "@/components/community/kit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Picker } from "@/components/ui/picker";
import { Sk } from "@/components/ui/skeleton";
import { onboardingApi, type AcademicLevel, type InvitePeek, type OnboardingOptions } from "@/lib/api/onboarding";
import { settingsApi, type Institution } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";
import { GHOST } from "./frame";

// Used only where an institution has no academic reference data yet.
const FALLBACK_LEVELS: AcademicLevel[] = ["100L", "200L", "300L", "400L", "500L", "Postgraduate"].map((l) => ({ code: l, label: l, tier: "" }));
const ROLES = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
  { value: "alumni", label: "Alumni" },
];
type Inst = Pick<Institution, "id" | "name" | "short_name">;
const LABEL = "px-1 pb-2 pt-6 text-micro font-semibold uppercase tracking-[0.08em] text-muted";

const monogram = (i: Inst) => (i.short_name ?? i.name.split(/\s+/).map((w) => w[0]).join("")).slice(0, 4).toUpperCase();

function Mono({ text }: { text: string }) {
  return <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-interactive text-[11px] font-extrabold tracking-wide text-fg">{text}</span>;
}

// The selected role is the white accent here; yellow is saved for the level chips and the main action.
function Segmented({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="I am a" className="flex gap-1 rounded-full bg-card p-1">
      {ROLES.map((r) => {
        const on = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r.value)}
            className={`h-10 flex-1 rounded-full text-[14px] transition-colors ${on ? "bg-fg font-extrabold text-bg" : "font-semibold text-muted hover:text-fg"}`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function LevelChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
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

// Institution comes from the institutions table. Where an institution has academic reference data, faculty, department and
// (when a department has more than one) programme are closed lists chosen by id, each unlocking after the one above and
// resetting everything below it when changed. Where it doesn't, faculty and department stay typed fields suggested from what
// exists, so an uncurated campus is never a dead end.
export function CampusStep({ invite, onSaved, onSkip }: { invite: InvitePeek | null; onSaved: () => void; onSkip: () => void }) {
  const { refresh } = useAuth();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Institution[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [hint, setHint] = useState<Institution | null>(null);
  const [inst, setInst] = useState<Inst | null>(null);
  const [opts, setOpts] = useState<OnboardingOptions | null>(null);
  // curated selections (ids as strings, the Picker's value type)
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  // uncurated free text
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (inst) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      settingsApi
        .institutions(q.trim(), ac.signal)
        .then((l) => {
          if (ac.signal.aborted) return;
          setList(l);
          setListErr(null);
        })
        .catch((e: unknown) => {
          if (!ac.signal.aborted) setListErr(messageOf(e));
        });
    }, q ? 300 : 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q, inst]);

  // A lecturer's desk link already says which campus it belongs to: offer it as one tap.
  const deskInst = invite?.desk?.institution?.name ?? null;
  useEffect(() => {
    if (!deskInst) return;
    let alive = true;
    settingsApi
      .institutions(deskInst)
      .then((l) => alive && setHint(l.find((i) => i.name.toLowerCase() === deskInst.toLowerCase()) ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [deskInst]);

  function choose(i: Inst) {
    setInst({ id: i.id, name: i.name, short_name: i.short_name });
    setOpts(null);
    setFacultyId("");
    setDepartmentId("");
    setProgrammeId("");
    setFaculty("");
    setDepartment("");
    setLevel(null);
    onboardingApi
      .options(i.id)
      .then(setOpts)
      .catch(() => setOpts({ curated: false, faculties: [], departments: [], tree: [], levels: [] }));
  }

  const curated = opts?.curated === true;
  const tree = opts?.tree ?? [];
  const fac = tree.find((f) => String(f.id) === facultyId) ?? null;
  const dep = fac?.departments.find((d) => String(d.id) === departmentId) ?? null;
  const programmes = dep?.programmes ?? [];
  const needsProgramme = programmes.length > 1;
  const programme = programmes.find((p) => String(p.id) === programmeId) ?? null;

  // Changing a level of the hierarchy always resets what hangs below it.
  function onFacultyPick(v: string) {
    if (v === facultyId) return;
    setFacultyId(v);
    setDepartmentId("");
    setProgrammeId("");
  }
  function onDepartmentPick(v: string) {
    if (v === departmentId) return;
    setDepartmentId(v);
    const d = fac?.departments.find((x) => String(x.id) === v);
    setProgrammeId(d && d.programmes.length === 1 ? String(d.programmes[0].id) : "");
  }

  // Uncurated only: typing a known department fills in its faculty.
  function onFacultyTyped(v: string) {
    setFaculty(v);
    if (department && !opts?.departments.some((d) => d.name === department && d.faculty === v)) setDepartment("");
  }
  function onDepartmentTyped(v: string) {
    setDepartment(v);
    const known = opts?.departments.find((d) => d.name.toLowerCase() === v.trim().toLowerCase());
    if (known?.faculty && !faculty.trim()) setFaculty(known.faculty);
  }

  const facultyOptions = useMemo(() => tree.map((f) => ({ value: String(f.id), label: f.name })), [tree]);
  const departmentOptions = useMemo(() => (fac?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name })), [fac]);
  const programmeOptions = useMemo(() => programmes.map((p) => ({ value: String(p.id), label: p.name, hint: p.award })), [programmes]);

  // Levels follow the programme's tier (degree until one is known); postgraduate is always offered.
  const levelOptions = useMemo(() => {
    const all = opts?.levels ?? [];
    if (!curated || all.length === 0) return FALLBACK_LEVELS;
    const tier = programme?.tier ?? "degree";
    return all.filter((l) => l.tier === tier || l.tier === "postgraduate");
  }, [opts, curated, programme]);
  const lvl = levelOptions.some((l) => l.code === level) ? level : null;

  const ready = !curated || (!!dep && (!needsProgramme || !!programme) && (role !== "student" || !!lvl));

  async function save() {
    if (!inst || busy || !ready) return;
    setBusy(true);
    setErr(null);
    try {
      const common = { institution_id: inst.id, level: role === "student" ? lvl : null, campus_role: role };
      await onboardingApi.saveCampus(
        curated && dep
          ? { ...common, academic_unit_id: dep.id, academic_programme_id: programme?.id ?? null }
          : { ...common, faculty: faculty.trim() || null, department: department.trim() || null },
      );
      await refresh();
      onSaved();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }

  if (!inst) {
    return (
      <>
        {hint && (
          <button type="button" onClick={() => choose(hint)} className="mb-4 flex items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5 text-left transition-colors hover:bg-card-elevated">
            <Mono text={monogram(hint)} />
            <span className="min-w-0 flex-1">
              <span className="block text-supporting text-muted">This link is for</span>
              <span className="block truncate text-[15px] font-bold text-fg">{hint.short_name ?? hint.name}</span>
            </span>
            <span className="text-secondary font-bold text-fg">That&apos;s me</span>
          </button>
        )}
        <div className="flex h-12 items-center gap-2.5 rounded-full bg-card px-4 focus-within:ring-2 focus-within:ring-brand/60">
          <Icon name="search" className="size-5 shrink-0 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your institution" aria-label="Search institutions" className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-muted" />
        </div>
        <div className="no-scrollbar mt-2 max-h-[44dvh] flex-1 overflow-y-auto md:max-h-[380px]">
          {listErr ? (
            <p className="py-8 text-center text-body text-muted">{listErr}</p>
          ) : list === null ? (
            <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3 py-3">
              {[0, 1, 2, 3].map((k) => <Sk key={k} className="h-12 w-full rounded-2xl" />)}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-body leading-snug text-muted">We don&apos;t have that institution yet. You can skip this and add it later.</p>
          ) : (
            <ul>
              {list.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => choose(i)} className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-card">
                    <Mono text={monogram(i)} />
                    <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-fg">{i.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={onSkip} className={`${GHOST} mt-4`}>Skip for now</button>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3.5 rounded-2xl bg-card px-4 py-3.5">
        <Mono text={monogram(inst)} />
        <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-fg">{inst.name}</span>
        <button type="button" onClick={() => { setInst(null); setOpts(null); }} className="text-secondary font-bold text-muted hover:text-fg">Change</button>
      </div>

      <p className={LABEL}>I am a</p>
      <Segmented value={role} onChange={setRole} />

      <p className={LABEL}>Faculty</p>
      {curated ? (
        <Picker label="Faculty" value={facultyId} options={facultyOptions} onChange={onFacultyPick} placeholder="Select your faculty" />
      ) : opts === null ? (
        <Picker label="Faculty" value="" options={[]} onChange={() => {}} disabled disabledText="Loading…" />
      ) : (
        <>
          <input className={inputClass} list="ob-faculties" value={faculty} onChange={(e) => onFacultyTyped(e.target.value)} placeholder="e.g. Engineering" maxLength={60} />
          <datalist id="ob-faculties">{opts.faculties.map((f) => <option key={f} value={f} />)}</datalist>
        </>
      )}

      <p className={LABEL}>Department</p>
      {curated ? (
        <Picker label="Department" value={departmentId} options={departmentOptions} onChange={onDepartmentPick} placeholder="Select your department" disabled={!fac} disabledText="Choose a faculty first" />
      ) : opts === null ? (
        <Picker label="Department" value="" options={[]} onChange={() => {}} disabled disabledText="Loading…" />
      ) : (
        <>
          <input className={inputClass} list="ob-departments" value={department} onChange={(e) => onDepartmentTyped(e.target.value)} placeholder="Type yours if it isn't suggested" maxLength={60} />
          <datalist id="ob-departments">{opts.departments.map((d) => <option key={d.name} value={d.name} />)}</datalist>
        </>
      )}

      {curated && needsProgramme && (
        <>
          <p className={LABEL}>Programme</p>
          <Picker label="Programme" value={programmeId} options={programmeOptions} onChange={setProgrammeId} placeholder="Select your programme" />
        </>
      )}

      {role === "student" && (
        <>
          <p className={LABEL}>Level</p>
          <div className="flex flex-wrap gap-2">
            {levelOptions.map((l) => <LevelChip key={l.code} on={lvl === l.code} onClick={() => setLevel(lvl === l.code ? null : l.code)}>{l.label}</LevelChip>)}
          </div>
        </>
      )}

      {err && <p role="alert" className="mt-4 text-secondary text-danger">{err}</p>}
      <div className="mt-auto flex flex-col gap-1 pt-8">
        {curated && !ready && (
          <p className="pb-3 text-center text-supporting text-muted">
            {role === "student"
              ? needsProgramme ? "Pick your faculty, department, programme and level to find your classes." : "Pick your faculty, department and level to find your classes."
              : "Pick your faculty and department to continue."}
          </p>
        )}
        <Button disabled={busy || !ready} onClick={() => void save()} className="h-14 w-full">{busy ? "Saving…" : "Continue"}</Button>
        <button type="button" disabled={busy} onClick={onSkip} className={GHOST}>Skip for now</button>
      </div>
    </>
  );
}
