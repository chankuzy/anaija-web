"use client";

import { useState } from "react";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { Footnote, Group, SectionLabel, SettingsPage } from "@/components/settings/settings-kit";
import { errMsg } from "@/lib/api/platform";
import { platformAcademicApi, type AcademicOverview, type AcademicUnit, type Discrepancy, type UnitVerification } from "@/lib/api/platform-academic";
import { useCached } from "@/lib/cache/swr";

const INSTITUTION_ID = 1; // AFIT. Becomes a selector when a second institution is curated.
const PILL: Record<UnitVerification, string> = {
  verified: "bg-brand/15 text-brand",
  unverified: "bg-white/8 text-muted",
  conflicting: "bg-danger/15 text-danger",
};
const btn = "h-8 shrink-0 rounded-full bg-surface-interactive px-3.5 text-supporting font-bold text-fg transition-colors hover:bg-card-elevated disabled:opacity-50";

function Row({ u, indent, busy, run }: { u: AcademicUnit; indent: boolean; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const c = u.community;
  const ask = (q: string, min: number) => {
    const v = window.prompt(q);
    return v && v.trim().length >= min ? v.trim() : null;
  };
  return (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-3.5 ${indent ? "pl-9" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] text-fg ${u.kind === "faculty" ? "font-extrabold" : "font-semibold"} ${u.is_active ? "" : "opacity-60"}`}>{u.name}</p>
        <p className="truncate text-supporting text-muted">
          {u.is_active ? "Active" : "Inactive"} · {c ? `${c.discoverability}, ${c.members_count} members` : "no community yet"}
          {u.open_discrepancies > 0 ? ` · ${u.open_discrepancies} open issue${u.open_discrepancies === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-supporting font-bold ${PILL[u.verification]}`}>{u.verification}</span>
      {u.verification !== "verified" && (
        <button type="button" disabled={busy} className={btn} onClick={() => {
          const note = ask("How did you confirm this? Source, method, date.", 10);
          if (note) run(() => platformAcademicApi.editUnit(u.id, { verification: "verified", note }));
        }}>Verify</button>
      )}
      {c && (
        <button type="button" disabled={busy} className={btn} onClick={() => run(() => platformAcademicApi.setListing(u.id, c.discoverability !== "listed"))}>
          {c.discoverability === "listed" ? "Unlist" : "List"}
        </button>
      )}
    </div>
  );
}

function Issue({ d, busy, run }: { d: Discrepancy; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const close = (status: "resolved" | "dismissed") => {
    const r = window.prompt(status === "resolved" ? "What was decided, and why?" : "Why is this being dismissed?");
    if (r && r.trim().length >= 5) run(() => platformAcademicApi.closeDiscrepancy(d.id, status, r.trim()));
  };
  return (
    <div className="px-4 py-3.5">
      <p className="text-supporting font-bold uppercase tracking-wide text-muted">{d.kind.replace(/_/g, " ")} · {d.entity_kind}</p>
      <p className="mt-1 text-secondary leading-snug text-fg">{d.summary}</p>
      <div className="mt-2.5 flex gap-2">
        <button type="button" disabled={busy} className={btn} onClick={() => close("resolved")}>Resolve</button>
        <button type="button" disabled={busy} className={btn} onClick={() => close("dismissed")}>Dismiss</button>
      </div>
    </div>
  );
}

export function AcademicView() {
  const ov = useCached<AcademicOverview>("admin:academic", () => platformAcademicApi.overview(INSTITUTION_ID), { staleMs: 0 });
  const dc = useCached<{ data: Discrepancy[]; next_cursor: string | null }>("admin:academic:disc", () => platformAcademicApi.discrepancies(INSTITUTION_ID), { staleMs: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, done?: (r: any) => string) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (done) setMsg(done(r));
      await Promise.all([ov.refresh(), dc.refresh()]);
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ov.data) {
    return (
      <SettingsPage title="Academic structure" backHref="/admin/accounts">
        {ov.error ? <p className="py-16 text-center text-body text-muted">{ov.error}</p> : <SettingsGroupsSkeleton groups={2} rows={5} />}
      </SettingsPage>
    );
  }

  const units = ov.data.units;
  const faculties = units.filter((u) => u.kind === "faculty");

  return (
    <SettingsPage title="Academic structure" backHref="/admin/accounts">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => platformAcademicApi.provision(INSTITUTION_ID), (r) => `Created ${r.created.length} unlisted communities. Unlisted ${r.unlisted_discontinued} discontinued.`)}
        className="mb-2 h-12 w-full rounded-full bg-brand text-[15px] font-extrabold text-brand-fg transition hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Working…" : "Provision official communities"}
      </button>
      <Footnote>Creates a community for every verified faculty and department that lacks one. New spaces start unlisted: review, then List.</Footnote>
      {msg && <p role="status" className="mt-3 px-1 text-secondary text-fg">{msg}</p>}

      <SectionLabel>Faculties and departments</SectionLabel>
      <Group>
        {faculties.map((f) => (
          <div key={f.id}>
            <Row u={f} indent={false} busy={busy} run={run} />
            {units.filter((d) => d.parent_id === f.id).map((d) => <Row key={d.id} u={d} indent busy={busy} run={run} />)}
          </div>
        ))}
      </Group>

      <SectionLabel>Open discrepancies ({ov.data.open_total})</SectionLabel>
      <Group>
        {(dc.data?.data ?? []).length === 0 && <p className="px-4 py-6 text-body text-muted">Nothing open.</p>}
        {(dc.data?.data ?? []).map((d) => <Issue key={d.id} d={d} busy={busy} run={run} />)}
      </Group>
      <Footnote>Only verified, active units can be listed. Renaming a unit keeps the old name as an alias.</Footnote>
    </SettingsPage>
  );
}
