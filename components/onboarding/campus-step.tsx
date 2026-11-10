"use client";

import { useEffect, useState } from "react";
import { Chip, messageOf } from "@/components/community/kit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Sk } from "@/components/ui/skeleton";
import { onboardingApi, type InvitePeek, type OnboardingOptions } from "@/lib/api/onboarding";
import { settingsApi, type Institution } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";
import { GHOST } from "./frame";

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "Postgraduate"];
const ROLES: [string, string][] = [["student", "Student"], ["staff", "Staff"], ["alumni", "Alumni"]];
type Inst = Pick<Institution, "id" | "name" | "short_name">;
const LABEL = "px-1 pb-2 pt-6 text-micro font-semibold uppercase tracking-[0.08em] text-muted";

// Institution comes from the real institutions table. Faculty and department are free text, suggested from what
// already exists at that institution, so nothing is invented and an unlisted department is never a dead end.
export function CampusStep({ invite, onSaved, onSkip }: { invite: InvitePeek | null; onSaved: () => void; onSkip: () => void }) {
  const { refresh } = useAuth();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Institution[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [hint, setHint] = useState<Institution | null>(null);
  const [inst, setInst] = useState<Inst | null>(null);
  const [opts, setOpts] = useState<OnboardingOptions | null>(null);
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
    onboardingApi.options(i.id).then(setOpts).catch(() => setOpts({ faculties: [], departments: [] }));
  }

  function onDepartment(v: string) {
    setDepartment(v);
    const known = opts?.departments.find((d) => d.name.toLowerCase() === v.trim().toLowerCase());
    if (known?.faculty && !faculty.trim()) setFaculty(known.faculty);
  }

  async function save() {
    if (!inst || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onboardingApi.saveCampus({
        institution_id: inst.id,
        faculty: faculty.trim() || null,
        department: department.trim() || null,
        level,
        campus_role: role,
      });
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
          <button type="button" onClick={() => choose(hint)} className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-interactive px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated">
            <Icon name="diploma" className="size-6 shrink-0 text-fg" />
            <span className="min-w-0 flex-1">
              <span className="block text-supporting text-muted">This link is for</span>
              <span className="block truncate text-[15px] font-bold text-fg">{hint.short_name ?? hint.name}</span>
            </span>
            <span className="text-secondary font-bold text-fg">That&apos;s me</span>
          </button>
        )}
        <div className="flex h-12 items-center gap-2.5 rounded-full bg-surface-interactive px-4">
          <Icon name="search" className="size-5 shrink-0 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your institution" aria-label="Search institutions" className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-muted" />
        </div>
        <div className="no-scrollbar mt-2 max-h-[40dvh] flex-1 overflow-y-auto md:max-h-[360px]">
          {listErr ? (
            <p className="py-8 text-center text-body text-muted">{listErr}</p>
          ) : list === null ? (
            <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3 py-3">
              {[0, 1, 2, 3].map((k) => <Sk key={k} className="h-10 w-full rounded-xl" />)}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-body leading-snug text-muted">We don&apos;t have that institution yet. You can skip this and add it later.</p>
          ) : (
            <ul>
              {list.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => choose(i)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-surface-interactive">
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg">{i.name}</span>
                    {i.short_name && <span className="shrink-0 text-secondary text-muted">{i.short_name}</span>}
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
      <div className="flex items-center gap-3 rounded-2xl bg-surface-interactive px-4 py-3.5">
        <Icon name="checkCircle" filled className="size-6 shrink-0 text-fg" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-fg">{inst.name}</span>
        <button type="button" onClick={() => { setInst(null); setOpts(null); }} className="text-secondary font-bold text-muted hover:text-fg">Change</button>
      </div>

      <p className={LABEL}>I am a</p>
      <div className="flex flex-wrap gap-2">
        {ROLES.map(([v, l]) => <Chip key={v} active={role === v} onClick={() => setRole(v)}>{l}</Chip>)}
      </div>

      <p className={LABEL}>Faculty <span className="font-medium normal-case tracking-normal">(optional)</span></p>
      <input className={inputClass} list="ob-faculties" value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Engineering" maxLength={60} />
      <datalist id="ob-faculties">{(opts?.faculties ?? []).map((f) => <option key={f} value={f} />)}</datalist>

      <p className={LABEL}>Department <span className="font-medium normal-case tracking-normal">(optional)</span></p>
      <input className={inputClass} list="ob-departments" value={department} onChange={(e) => onDepartment(e.target.value)} placeholder="Type yours if it isn't suggested" maxLength={60} />
      <datalist id="ob-departments">{(opts?.departments ?? []).map((d) => <option key={d.name} value={d.name} />)}</datalist>

      {role === "student" && (
        <>
          <p className={LABEL}>Level <span className="font-medium normal-case tracking-normal">(optional)</span></p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => <Chip key={l} active={level === l} onClick={() => setLevel(level === l ? null : l)}>{l}</Chip>)}
          </div>
        </>
      )}

      {err && <p role="alert" className="mt-4 text-secondary text-danger">{err}</p>}
      <div className="mt-auto flex flex-col gap-1 pt-8">
        <Button disabled={busy} onClick={() => void save()} className="h-14 w-full">{busy ? "Saving…" : "Continue"}</Button>
        <button type="button" disabled={busy} onClick={onSkip} className={GHOST}>Skip for now</button>
      </div>
    </>
  );
}
