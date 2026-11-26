"use client";
import { SettingsGroupsSkeleton, UserRowsSkeleton } from "@/components/ui/skeleton";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Picker } from "@/components/ui/picker";
import { ApiError } from "@/lib/api/client";
import { onboardingApi, type AcademicLevel, type OnboardingOptions } from "@/lib/api/onboarding";
import { settingsApi, type CampusProfile, type Institution } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";
import { useCached } from "@/lib/cache/swr";
import { Group, SectionLabel, SettingsPage, Tile, useRequireAuth, useToast } from "./settings-kit";

// profile-get already returns these; CampusProfile just doesn't type them yet.
type CampusFull = CampusProfile & {
  department?: string | null;
  academic_unit_id?: number | null;
  academic_programme_id?: number | null;
};

// Used only where an institution has no academic reference data yet.
const FALLBACK_LEVELS: AcademicLevel[] = ["100L", "200L", "300L", "400L", "500L", "Postgraduate"].map((l) => ({ code: l, label: l, tier: "" }));
const ROLES: [string, string][] = [
  ["student", "Student"],
  ["staff", "Staff"],
  ["alumni", "Alumni"],
];

// "300", "300L" and "Level 300" are the same level; postgraduate is always "PG". ND1/HND2 stay as they are.
const toCode = (v: string | null | undefined) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return "";
  if (/^(PG|POST|MSC|M\.SC|PHD|PH\.D)/.test(s)) return "PG";
  const m = s.match(/\d{3}/);
  return m ? m[0] : s;
};

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[14px] transition ${
        selected ? "bg-brand font-extrabold text-brand-fg" : "bg-surface-interactive font-bold text-fg/70 hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}

function InstitutionPicker({ onPick, onClose }: { onPick: (i: Institution) => void; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [res, setRes] = useState<{ q: string; list: Institution[] | null; error: string | null }>({ q: "\u0000", list: null, error: null });

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 350);
    return () => window.clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const ac = new AbortController();
    settingsApi
      .institutions(query, ac.signal)
      .then((list) => !ac.signal.aborted && setRes({ q: query, list, error: null }))
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setRes({ q: query, list: null, error: e instanceof ApiError ? e.message : "Something went wrong." });
      });
    return () => ac.abort();
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loading = res.q !== query;
  let body;
  if (res.error) body = <p className="py-10 text-center text-body text-muted">{res.error}</p>;
  else if (res.list === null || (loading && res.list.length === 0)) body = <UserRowsSkeleton avatar={false} count={7} />;
  else if (res.list.length === 0) body = <p className="py-10 text-center text-body text-muted">No institutions found</p>;
  else
    body = (
      <ul className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {res.list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onPick(i)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-fg/6">
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg">{i.name}</span>
              {i.short_name && <span className="shrink-0 text-secondary text-muted">{i.short_name}</span>}
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Your institution">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60" />
      <div className="glass relative flex h-[min(78dvh,600px)] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] md:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-[17px] font-bold tracking-tight text-fg">Your institution</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-full text-fg/60 hover:bg-fg/8 hover:text-fg">
            <Icon name="close" className="size-6" />
          </button>
        </div>
        <div className="px-4 pb-2">
          <div className="flex h-11 items-center gap-2.5 rounded-full bg-surface-interactive px-4">
            <Icon name="search" className="size-5 shrink-0 text-muted" />
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search institutions"
              className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto pb-4">{body}</div>
      </div>
    </div>
  );
}

// Same rules as onboarding: where the institution has academic reference data, faculty > department > programme are closed
// lists saved by id, each resetting what hangs below it. Where it doesn't, faculty and department stay typed text.
function CampusForm({ initial, onSaved }: { initial: CampusFull; onSaved: () => void }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const { toast, show } = useToast();
  const [inst, setInst] = useState<{ id: number; name: string } | null>(initial.institution);
  const [opts, setOpts] = useState<OnboardingOptions | null>(null);
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [faculty, setFaculty] = useState(initial.faculty ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [level, setLevel] = useState<string | null>(initial.level);
  const [role, setRole] = useState(initial.campus_role ?? "student");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  // Load the academic structure for the chosen institution. The first load also pre-selects what the user already has.
  useEffect(() => {
    if (!inst) {
      setOpts(null);
      return;
    }
    let alive = true;
    setOpts(null);
    onboardingApi
      .options(inst.id)
      .then((o) => {
        if (!alive) return;
        setOpts(o);
        if (!seeded.current && inst.id === initial.institution?.id && o.curated && initial.academic_unit_id) {
          const uid = initial.academic_unit_id;
          for (const f of o.tree) {
            if (f.id === uid) {
              setFacultyId(String(f.id));
              break;
            }
            const d = f.departments.find((x) => x.id === uid);
            if (d) {
              setFacultyId(String(f.id));
              setDepartmentId(String(d.id));
              const pid = initial.academic_programme_id ?? (d.programmes.length === 1 ? d.programmes[0].id : null);
              if (pid) setProgrammeId(String(pid));
              break;
            }
          }
        }
        seeded.current = true;
      })
      .catch(() => {
        if (!alive) return;
        setOpts({ curated: false, faculties: [], departments: [], tree: [], levels: [] });
        seeded.current = true;
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id]);

  const curated = opts?.curated === true;
  const tree = opts?.tree ?? [];
  const fac = tree.find((f) => String(f.id) === facultyId) ?? null;
  const dep = fac?.departments.find((d) => String(d.id) === departmentId) ?? null;
  const programmes = dep?.programmes ?? [];
  const needsProgramme = programmes.length > 1;
  const programme = programmes.find((p) => String(p.id) === programmeId) ?? null;

  function pickInstitution(i: Institution) {
    setInst({ id: i.id, name: i.name });
    setFacultyId("");
    setDepartmentId("");
    setProgrammeId("");
    setFaculty("");
    setDepartment("");
    setLevel(null);
    setPicking(false);
  }

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

  const levelOptions = useMemo(() => {
    const all = opts?.levels ?? [];
    if (!curated || all.length === 0) return FALLBACK_LEVELS;
    const tier = programme?.tier ?? "degree";
    return all.filter((l) => l.tier === tier || l.tier === "postgraduate");
  }, [opts, curated, programme]);
  const lvl = levelOptions.find((l) => toCode(l.code) === toCode(level))?.code ?? null;

  const ready = !curated || (!!dep && (!needsProgramme || !!programme) && (role !== "student" || !!lvl));
  const hadText = !!(initial.faculty || initial.department);

  async function save() {
    if (busy) return;
    if (!inst) return show("Choose your institution first");
    if (!ready) return;
    setBusy(true);
    try {
      const common = { institution_id: inst.id, level: role === "student" ? lvl : null, campus_role: role };
      await onboardingApi.saveCampus(
        curated && dep
          ? { ...common, academic_unit_id: dep.id, academic_programme_id: programme?.id ?? null }
          : { ...common, faculty: faculty.trim(), department: department.trim() },
      );
      onSaved();
      await refresh();
      router.replace("/settings");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <SettingsPage title="Campus & Institution" backHref="/settings">
      <SectionLabel>Institution</SectionLabel>
      <Group>
        <Tile icon="diploma" label={inst?.name ?? "Choose your institution"} trailing={inst ? "Change" : undefined} onClick={() => setPicking(true)} />
      </Group>

      {inst && (
        <>
          {curated && !dep && hadText && !initial.academic_unit_id && (
            <p className="mt-5 px-1 text-secondary leading-[1.45] text-muted">We&apos;ve updated our faculty and department lists. Please choose yours again.</p>
          )}

          <div className="h-6" />
          <SectionLabel>Faculty</SectionLabel>
          {curated ? (
            <Picker label="Faculty" value={facultyId} options={facultyOptions} onChange={onFacultyPick} placeholder="Select your faculty" />
          ) : opts === null ? (
            <Picker label="Faculty" value="" options={[]} onChange={() => {}} disabled disabledText="Loading…" />
          ) : (
            <>
              <input className={inputClass} list="cv-faculties" value={faculty} onChange={(e) => onFacultyTyped(e.target.value)} placeholder="e.g. Engineering" maxLength={60} />
              <datalist id="cv-faculties">{opts.faculties.map((f) => <option key={f} value={f} />)}</datalist>
            </>
          )}

          <div className="h-6" />
          <SectionLabel>Department</SectionLabel>
          {curated ? (
            <Picker label="Department" value={departmentId} options={departmentOptions} onChange={onDepartmentPick} placeholder="Select your department" disabled={!fac} disabledText="Choose a faculty first" />
          ) : opts === null ? (
            <Picker label="Department" value="" options={[]} onChange={() => {}} disabled disabledText="Loading…" />
          ) : (
            <>
              <input className={inputClass} list="cv-departments" value={department} onChange={(e) => onDepartmentTyped(e.target.value)} placeholder="Type yours if it isn't suggested" maxLength={60} />
              <datalist id="cv-departments">{opts.departments.map((d) => <option key={d.name} value={d.name} />)}</datalist>
            </>
          )}

          {curated && needsProgramme && (
            <>
              <div className="h-6" />
              <SectionLabel>Programme</SectionLabel>
              <Picker label="Programme" value={programmeId} options={programmeOptions} onChange={setProgrammeId} placeholder="Select your programme" />
            </>
          )}
        </>
      )}

      {role === "student" && (
        <>
          <div className="h-6" />
          <SectionLabel>Level</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {levelOptions.map((l) => (
              <Chip key={l.code} label={l.label} selected={lvl === l.code} onClick={() => setLevel(lvl === l.code ? null : l.code)} />
            ))}
          </div>
        </>
      )}

      <div className="h-6" />
      <SectionLabel>I am a</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {ROLES.map(([v, label]) => (
          <Chip key={v} label={label} selected={role === v} onClick={() => setRole(v)} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || (!!inst && !ready)}
        className="mt-8 h-12 w-full rounded-full bg-brand text-[15px] font-extrabold text-brand-fg transition hover:bg-brand-hover active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>

      {picking && <InstitutionPicker onClose={() => setPicking(false)} onPick={pickInstitution} />}
      {toast}
    </SettingsPage>
  );
}

export function CampusView() {
  const ready = useRequireAuth();

  // Cached copy opens the form instantly; staleMs 0 re-reads the server on every visit in the background.
  const { data, error, refresh } = useCached<CampusFull>(
    ready ? "settings:campus" : null,
    () => settingsApi.campus() as Promise<CampusFull>,
    { staleMs: 0 },
  );

  if (data) return <CampusForm initial={data} onSaved={() => void refresh()} />;
  return (
    <SettingsPage title="Campus & Institution" backHref="/settings">
      {error ? (
        <div className="py-16 text-center">
          <p className="text-[17px] font-bold text-fg">Couldn&apos;t load</p>
          <p className="mt-1 text-body text-muted">{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg">
            Try again
          </button>
        </div>
      ) : (
        <SettingsGroupsSkeleton />
      )}
    </SettingsPage>
  );
}
