"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { platformApi, type PlatformAccount } from "@/lib/api/platform";
import { useCached } from "@/lib/cache/swr";
import { Footnote, Group, SectionLabel, SettingsPage, Tile } from "@/components/settings/settings-kit";
import { StatusPill } from "./status-pill";
import { useStaff } from "./staff-context";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function AccountRow({ a }: { a: PlatformAccount }) {
  const when = a.status === "active" && a.activated_at ? `Live since ${day(a.activated_at)}`
    : a.status === "suspended" && a.suspended_at ? `Suspended ${day(a.suspended_at)}`
    : `Created ${day(a.created_at)}`;
  return (
    <Link href={`/admin/accounts/${encodeURIComponent(a.key)}`} className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-white/5">
      <Avatar url={a.avatar} name={a.name ?? a.username} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{a.name ?? a.key}</p>
        <p className="truncate text-secondary text-muted">
          {a.username ? `@${a.username}` : a.key} · {a.followers.toLocaleString()} {a.followers === 1 ? "follower" : "followers"}
        </p>
        <p className="truncate text-supporting text-muted">{when}</p>
      </div>
      <StatusPill status={a.status} />
      <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

export function AccountsView() {
  const staff = useStaff();
  const { data, error, refresh } = useCached<PlatformAccount[]>(
    "admin:accounts",
    () => platformApi.accounts(),
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
      <SettingsGroupsSkeleton />
    );
  } else if (data.length === 0) {
    body = (
      <>
        <SectionLabel>Official accounts</SectionLabel>
        <Group>
          <p className="px-4 py-6 text-body text-muted">No official accounts are provisioned yet.</p>
        </Group>
      </>
    );
  } else {
    body = (
      <>
        <SectionLabel>Official accounts</SectionLabel>
        <Group>
          {data.map((a) => (
            <AccountRow key={a.key} a={a} />
          ))}
        </Group>
        <Footnote>Accounts stay hidden from the app until they are activated.</Footnote>
      </>
    );
  }

  const showContent = staff.can("content.write") || staff.can("content.publish") || staff.can("analytics.view");
  const showCommunities = staff.can("communities.moderate");
  const showStaff = staff.can("staff.manage");
  const showAudit = staff.can("audit.view");

  return (
    <SettingsPage title="Official accounts" backHref="/">
      {body}
      {(showContent || showCommunities || showStaff || showAudit) && (
        <>
          <div className="h-6" />
          <SectionLabel>Manage</SectionLabel>
          <Group>
            {showContent && <Tile icon="clapperboard" label="Content studio" href="/admin/content" />}
            {showCommunities && <Tile icon="usersGroupRounded" label="Communities" href="/admin/communities" />}
            {showStaff && <Tile icon="user" label="Staff" href="/admin/staff" />}
            {showAudit && <Tile icon="clockCircle" label="Audit log" href="/admin/audit" />}
          </Group>
        </>
      )}
      <div className="h-6" />
      <Footnote>Signed in as {staff.role.replace("_", " ")}.</Footnote>
    </SettingsPage>
  );
}
