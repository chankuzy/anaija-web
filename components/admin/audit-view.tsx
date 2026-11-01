"use client";

import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { errMsg, platformApi, type AuditRow } from "@/lib/api/platform";
import { Group, SectionLabel, SettingsPage } from "@/components/settings/settings-kit";
import { useStaff } from "./staff-context";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function short(detail: Record<string, unknown>) {
  const s = JSON.stringify(detail ?? {});
  return s === "{}" ? "" : s.length > 140 ? `${s.slice(0, 139)}…` : s;
}

export function AuditView() {
  const staff = useStaff();
  if (!staff.can("audit.view")) notFound();

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (c: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await platformApi.audit(c);
      setRows((prev) => (c ? [...prev, ...r.data] : r.data));
      setCursor(r.next_cursor);
      setLoaded(true);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <SettingsPage title="Audit log" backHref="/admin/accounts">
      {!loaded ? (
        err ? (
          <div className="py-16 text-center">
            <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
            <p className="mt-1 text-body text-muted">{err}</p>
            <button type="button" onClick={() => void load(null)} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-extrabold text-black">
              Try again
            </button>
          </div>
        ) : (
          <SettingsGroupsSkeleton groups={1} rows={5} />
        )
      ) : (
        <>
          <SectionLabel>Recent activity</SectionLabel>
          <Group>
            {rows.length === 0 && <p className="px-4 py-5 text-body text-muted">Nothing recorded yet.</p>}
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">{r.action}</p>
                  <span className="shrink-0 text-supporting text-muted">{when(r.created_at)}</span>
                </div>
                <p className="truncate text-secondary text-muted">
                  {r.actor ? (r.actor.name ?? r.actor.username ?? `User ${r.actor.id}`) : "System"}
                  {r.target_kind ? ` → ${r.target_kind} ${r.target_id ?? ""}` : ""}
                </p>
                {short(r.detail) && <p className="mt-0.5 break-all text-supporting text-white/40">{short(r.detail)}</p>}
              </div>
            ))}
          </Group>
          {err && <p className="px-2 pt-3 text-secondary text-danger">{err}</p>}
          {cursor && (
            <button type="button" disabled={busy} onClick={() => void load(cursor)} className="mt-4 h-11 w-full rounded-full bg-surface-interactive text-[15px] font-bold text-white disabled:opacity-50">
              {busy ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </SettingsPage>
  );
}
