"use client";
import { SettingsGroupsSkeleton, UserRowsSkeleton } from "@/components/ui/skeleton";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { settingsApi, type CampusProfile, type Institution } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";
import { useCached } from "@/lib/cache/swr";
import { Group, SectionLabel, SettingsPage, Tile, useRequireAuth, useToast } from "./settings-kit";

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "Postgraduate"];
const ROLES: [string, string][] = [
  ["student", "Student"],
  ["staff", "Staff"],
  ["alumni", "Alumni"],
];

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-[14px] transition ${
        selected ? "border-white/40 bg-white/14 font-bold text-white" : "border-white/14 font-medium text-white/70 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Picker({ onPick, onClose }: { onPick: (i: Institution) => void; onClose: () => void }) {
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
            <button type="button" onClick={() => onPick(i)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/6">
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-white">{i.name}</span>
              {i.short_name && <span className="shrink-0 text-secondary text-muted">{i.short_name}</span>}
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Your institution">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-xs" />
      <div className="glass relative flex h-[min(78dvh,600px)] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-black/80 md:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-[17px] font-bold tracking-tight text-white">Your institution</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-full text-white/60 hover:bg-white/8 hover:text-white">
            <Icon name="close" className="size-6" />
          </button>
        </div>
        <div className="px-4 pb-2">
          <div className="flex h-11 items-center gap-2.5 rounded-full border border-white/12 bg-white/6 px-4">
            <Icon name="search" className="size-5 shrink-0 text-muted" />
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search institutions"
              className="min-w-0 flex-1 bg-transparent text-body text-white outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto pb-4">{body}</div>
      </div>
    </div>
  );
}

function CampusForm({ initial, onSaved }: { initial: CampusProfile; onSaved: () => void }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const { toast, show } = useToast();
  const [inst, setInst] = useState<{ id: number; name: string } | null>(initial.institution);
  const [faculty, setFaculty] = useState(initial.faculty ?? "");
  const [level, setLevel] = useState<string | null>(initial.level);
  const [role, setRole] = useState(initial.campus_role ?? "student");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (!inst) return show("Choose your institution first");
    setBusy(true);
    try {
      await settingsApi.joinInstitution({
        institution_id: inst.id,
        faculty: faculty.trim() || null,
        level,
        campus_role: role,
      });
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

      <div className="h-6" />
      <SectionLabel>Faculty</SectionLabel>
      <input className={inputClass} value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="e.g. Engineering" />

      <div className="h-6" />
      <SectionLabel>Level</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Chip key={l} label={l} selected={level === l} onClick={() => setLevel(level === l ? null : l)} />
        ))}
      </div>

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
        disabled={busy}
        className="mt-8 h-12 w-full rounded-full bg-white text-[15px] font-bold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>

      {picking && (
        <Picker
          onClose={() => setPicking(false)}
          onPick={(i) => {
            setInst({ id: i.id, name: i.name });
            setPicking(false);
          }}
        />
      )}
      {toast}
    </SettingsPage>
  );
}

export function CampusView() {
  const ready = useRequireAuth();

  // Cached copy opens the form instantly; staleMs 0 re-reads the server on every visit in the background.
  const { data, error, refresh } = useCached<CampusProfile>(
    ready ? "settings:campus" : null,
    () => settingsApi.campus(),
    { staleMs: 0 },
  );

  if (data) return <CampusForm initial={data} onSaved={() => void refresh()} />;
  return (
    <SettingsPage title="Campus & Institution" backHref="/settings">
      {error ? (
        <div className="py-16 text-center">
          <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
          <p className="mt-1 text-body text-muted">{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black">
            Try again
          </button>
        </div>
      ) : (
        <SettingsGroupsSkeleton />
      )}
    </SettingsPage>
  );
}
