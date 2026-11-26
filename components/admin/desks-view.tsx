"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { VerifiedSeal } from "@/components/ui/verified-seal";
import { errMsg } from "@/lib/api/platform";
import { QUEUES, platformDesksApi, type DeskPage, type DeskQueue, type DeskVerification, type PlatformDesk } from "@/lib/api/platform-desks";
import { useCached } from "@/lib/cache/swr";
import { Footnote, Group, SettingsPage } from "@/components/settings/settings-kit";

const LABEL: Record<DeskVerification, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-fg/10 text-fg" },
  unverified: { label: "Not asked", cls: "bg-fg/8 text-fg/60" },
  verified: { label: "Verified", cls: "bg-brand/15 text-brand" },
  rejected: { label: "Rejected", cls: "bg-danger/15 text-danger" },
};

export function DeskStatusPill({ s }: { s: DeskVerification }) {
  const v = LABEL[s];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-supporting font-bold ${v.cls}`}>
      {s === "verified" && <VerifiedSeal size={15} decorative />}
      {v.label}
    </span>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

function Queue({ status }: { status: DeskQueue }) {
  const { data, error, refresh } = useCached<DeskPage>(`admin:desks:${status}`, () => platformDesksApi.list(status), { staleMs: 30_000 });
  const [more, setMore] = useState<{ items: PlatformDesk[]; cursor: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!data) {
    return error ? (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-fg">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-fg px-5 text-secondary font-extrabold text-bg">Try again</button>
      </div>
    ) : (
      <SettingsGroupsSkeleton groups={1} rows={4} />
    );
  }

  const items = [...data.data, ...(more?.items ?? [])];
  const cursor = more ? more.cursor : data.next_cursor;

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await platformDesksApi.list(status, cursor);
      setMore({ items: [...(more?.items ?? []), ...r.data], cursor: r.next_cursor });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Group>
        {items.length === 0 && <p className="px-4 py-6 text-body text-muted">{status === "pending" ? "No requests waiting." : "Nothing here."}</p>}
        {items.map((d) => (
          <Link key={d.id} href={`/admin/desks/${d.id}`} className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-fg/5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-fg">{d.course_code} · {d.course_title}</p>
              <p className="truncate text-secondary text-muted">
                {d.owner?.username ? `@${d.owner.username}` : "No owner"} · {d.members.toLocaleString()} {d.members === 1 ? "member" : "members"} · {day(d.verification_requested_at ?? d.created_at)}
              </p>
              {d.duplicates > 0 && <p className="truncate text-supporting text-brand">{d.duplicates} possible duplicate{d.duplicates === 1 ? "" : "s"}</p>}
            </div>
            <DeskStatusPill s={d.verification_status} />
            <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />
          </Link>
        ))}
      </Group>
      {cursor && (
        <button type="button" disabled={busy} onClick={() => void loadMore()} className="mx-auto mt-4 block h-10 rounded-full bg-surface-interactive px-6 text-secondary font-bold text-fg disabled:opacity-50">
          {busy ? "Loading…" : "Show more"}
        </button>
      )}
      {err && <p role="alert" className="mt-3 text-center text-secondary text-danger">{err}</p>}
    </>
  );
}

export function DesksView() {
  const [status, setStatus] = useState<DeskQueue>("pending");
  return (
    <SettingsPage title="Course Desks" backHref="/admin/accounts">
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {QUEUES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            className={`h-9 shrink-0 rounded-full px-4 text-secondary font-bold transition-colors ${status === id ? "bg-fg text-bg" : "bg-surface-interactive text-fg hover:bg-fg/10"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <Queue key={status} status={status} />
      <Footnote>Approving names a lecturer account. That person must already be a member of the desk.</Footnote>
    </SettingsPage>
  );
}
