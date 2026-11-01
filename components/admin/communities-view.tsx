"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { platformCommunitiesApi, type PlatformCommunity } from "@/lib/api/platform-communities";
import { useCached } from "@/lib/cache/swr";
import { Footnote, Group, SectionLabel, SettingsPage } from "@/components/settings/settings-kit";

function Pill({ c }: { c: PlatformCommunity }) {
  const cls = !c.is_active || c.status !== "active" ? "bg-danger/15 text-danger" : c.listed ? "bg-brand text-brand-fg" : "bg-white/8 text-white/70";
  const label = !c.is_active || c.status !== "active" ? "Inactive" : c.listed ? "Listed" : "Unlisted";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-supporting font-bold ${cls}`}>{label}</span>;
}

export function CommunitiesView() {
  const { data, error, refresh } = useCached<PlatformCommunity[]>(
    "admin:communities",
    () => platformCommunitiesApi.list(),
    { staleMs: 60_000 },
  );

  let body;
  if (!data) {
    body = error ? (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-extrabold text-black">
          Try again
        </button>
      </div>
    ) : (
      <SettingsGroupsSkeleton groups={1} rows={3} />
    );
  } else {
    body = (
      <>
        <SectionLabel>Platform communities</SectionLabel>
        <Group>
          {data.length === 0 && <p className="px-4 py-6 text-body text-muted">No platform communities are provisioned yet.</p>}
          {data.map((c) => (
            <Link key={c.key} href={`/admin/communities/${encodeURIComponent(c.key)}`} className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-white">{c.name}</p>
                <p className="truncate text-secondary text-muted">/{c.slug} · {c.members.toLocaleString()} {c.members === 1 ? "member" : "members"}</p>
              </div>
              <Pill c={c} />
              <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />
            </Link>
          ))}
        </Group>
        <Footnote>Unlisted communities exist but don&apos;t appear in Discover.</Footnote>
      </>
    );
  }

  return (
    <SettingsPage title="Communities" backHref="/admin/accounts">
      {body}
    </SettingsPage>
  );
}
