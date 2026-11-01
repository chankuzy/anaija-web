/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { errMsg, platformApi, type PlatformAccount } from "@/lib/api/platform";
import { platformContentApi, type ContentItem, type ContentStatus } from "@/lib/api/platform-content";
import { useCached } from "@/lib/cache/swr";
import { Footnote, Group, SectionLabel, SettingsPage } from "@/components/settings/settings-kit";
import { ContentStatusPill, fmtWhen } from "./content-status";
import { useStaff } from "./staff-context";

const TABS: { id: ContentStatus; label: string }[] = [
  { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Live" },
  { id: "archived", label: "Archived" },
];

function timeLine(i: ContentItem) {
  if (i.status === "scheduled" && i.scheduled_at) return `Goes live ${fmtWhen(i.scheduled_at)}`;
  if (i.status === "published" && i.published_at) return `Published ${fmtWhen(i.published_at)}`;
  return `Edited ${fmtWhen(i.updated_at)}`;
}

function Row({ i }: { i: ContentItem }) {
  const m = i.media[0];
  const thumb = m?.thumbnail_url ?? m?.url ?? null;
  return (
    <Link href={`/admin/content/${i.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5">
      {thumb ? (
        <img src={thumb} alt="" className="size-12 shrink-0 rounded-xl bg-card object-cover" />
      ) : (
        <span className="size-12 shrink-0 rounded-xl bg-surface-interactive" />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{i.caption || "No caption"}</p>
        <p className="truncate text-supporting text-muted">{i.account?.name ?? i.account?.key ?? "Account"} · {timeLine(i)}</p>
        {i.last_error && <p className="truncate text-supporting text-danger">{i.last_error}</p>}
      </div>
      <ContentStatusPill status={i.status} />
    </Link>
  );
}

export function ContentView() {
  const staff = useStaff();
  const accounts = useCached<PlatformAccount[]>("admin:accounts", () => platformApi.accounts(), { staleMs: 60_000 });
  const [account, setAccount] = useState("");
  const [tab, setTab] = useState<ContentStatus>("draft");
  const [rows, setRows] = useState<ContentItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (c: string | null) => {
    const mine = ++seq.current;
    setBusy(true);
    setErr(null);
    try {
      const r = await platformContentApi.list({ account: account || undefined, status: tab, cursor: c });
      if (mine !== seq.current) return;
      setRows((prev) => (c ? [...prev, ...r.data] : r.data));
      setCursor(r.next_cursor);
      setLoaded(true);
    } catch (e) {
      if (mine === seq.current) setErr(errMsg(e));
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }, [account, tab]);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    void load(null);
  }, [load]);

  const action = staff.can("content.write") ? (
    <Link href="/admin/content/new" className="grid h-10 place-items-center rounded-full bg-white px-5 text-secondary font-extrabold text-black">
      New
    </Link>
  ) : undefined;

  return (
    <SettingsPage title="Content studio" backHref="/admin/accounts" action={action}>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`h-9 shrink-0 rounded-full px-4 text-secondary font-bold ${tab === t.id ? "bg-white text-black" : "bg-surface-interactive text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {(accounts.data?.length ?? 0) > 1 && (
        <select aria-label="Account" value={account} onChange={(e) => setAccount(e.target.value)}
          className="mb-4 h-10 w-full rounded-full bg-surface-interactive px-4 text-secondary font-bold text-white outline-none">
          <option value="" className="bg-[#26262b]">All accounts</option>
          {accounts.data?.map((a) => (
            <option key={a.key} value={a.key} className="bg-[#26262b]">{a.name ?? a.key}</option>
          ))}
        </select>
      )}

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
          <SettingsGroupsSkeleton groups={1} rows={4} />
        )
      ) : (
        <>
          <SectionLabel>{TABS.find((t) => t.id === tab)?.label}</SectionLabel>
          <Group>
            {rows.length === 0 && <p className="px-4 py-6 text-body text-muted">Nothing here.</p>}
            {rows.map((i) => (
              <Row key={i.id} i={i} />
            ))}
          </Group>
          {err && <p className="px-2 pt-3 text-secondary text-danger">{err}</p>}
          {cursor && (
            <button type="button" disabled={busy} onClick={() => void load(cursor)} className="mt-4 h-11 w-full rounded-full bg-surface-interactive text-[15px] font-bold text-white disabled:opacity-50">
              {busy ? "Loading…" : "Load more"}
            </button>
          )}
          {tab === "scheduled" && <Footnote>Scheduled items publish automatically at their time. If one can&apos;t, it returns to Drafts with the reason.</Footnote>}
        </>
      )}
    </SettingsPage>
  );
}
