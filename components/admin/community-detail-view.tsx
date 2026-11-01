"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { errMsg } from "@/lib/api/platform";
import { PERMISSION_ACTIONS, platformCommunitiesApi, type PlatformCommunity } from "@/lib/api/platform-communities";
import { revalidate, useCached } from "@/lib/cache/swr";
import { confirmDialog } from "@/lib/ui/dialog";
import { Footnote, Group, SectionLabel, SettingsPage, Tile, Toggle, useToast } from "@/components/settings/settings-kit";
import { useStaff } from "./staff-context";

const ROLE_OPTIONS = [
  { v: "member", l: "Any member" },
  { v: "moderator", l: "Moderators and up" },
  { v: "admin", l: "Admins only" },
];

export function CommunityDetailView() {
  const { key } = useParams<{ key: string }>();
  const staff = useStaff();
  const manage = staff.can("communities.manage");
  const { toast, show } = useToast();
  const { data: c, error, refresh } = useCached<PlatformCommunity>(
    `admin:community:${key}`,
    () => platformCommunitiesApi.get(key),
    { staleMs: 30_000 },
  );
  const [desc, setDesc] = useState<string | null>(null);
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function reload() {
    await refresh();
    void revalidate("admin:communities", () => platformCommunitiesApi.list());
  }

  async function save() {
    if (!c) return;
    const body: { description?: string; permissions?: Record<string, string> } = {};
    if (desc !== null && desc !== c.description) body.description = desc;
    const changed = Object.fromEntries(
      Object.entries(perms).filter(([k, v]) => v !== (c.permissions[k] ?? PERMISSION_ACTIONS.find((a) => a.key === k)?.def)),
    );
    if (Object.keys(changed).length) body.permissions = changed;
    if (!Object.keys(body).length) return;
    setBusy(true);
    try {
      await platformCommunitiesApi.update(key, body);
      setDesc(null);
      setPerms({});
      await reload();
      show("Saved");
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleListing(v: boolean) {
    if (!c) return;
    const ok = await confirmDialog({
      title: v ? `List ${c.name} in Discover?` : `Hide ${c.name} from Discover?`,
      message: v ? "Anyone can find and join it." : "It stays reachable by direct link for existing members and staff.",
      confirmLabel: v ? "List it" : "Hide it",
      danger: !v,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await platformCommunitiesApi.setListing(key, v);
      await reload();
      show(v ? "Listed" : "Hidden");
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (!c) {
    body = error ? (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-extrabold text-black">
          Try again
        </button>
      </div>
    ) : (
      <SettingsGroupsSkeleton groups={2} rows={3} />
    );
  } else {
    const description = desc ?? c.description;
    const dirty =
      description !== c.description ||
      Object.entries(perms).some(([k, v]) => v !== (c.permissions[k] ?? PERMISSION_ACTIONS.find((a) => a.key === k)?.def));
    body = (
      <>
        <SectionLabel>About</SectionLabel>
        <Group>
          <div className="space-y-3 p-4">
            <textarea aria-label="Description" rows={4} maxLength={500} value={description} disabled={!manage || busy}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full resize-none rounded-[18px] bg-surface-interactive px-4 py-3 text-[15px] leading-[1.4] text-white outline-none disabled:opacity-60" />
            <p className="text-supporting text-muted">
              /{c.slug} · {c.members.toLocaleString()} {c.members === 1 ? "member" : "members"}
              {c.join_policy ? ` · join: ${c.join_policy}` : ""}{c.read_policy ? ` · read: ${c.read_policy}` : ""}
            </p>
          </div>
        </Group>

        <div className="h-6" />
        <SectionLabel>Who can…</SectionLabel>
        <Group>
          {PERMISSION_ACTIONS.map((a) => (
            <div key={a.key} className="flex items-center gap-3.5 px-4 py-3">
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-white">{a.label}</span>
              <select aria-label={a.label} disabled={!manage || busy}
                value={perms[a.key] ?? c.permissions[a.key] ?? a.def}
                onChange={(e) => setPerms((p) => ({ ...p, [a.key]: e.target.value }))}
                className="h-10 rounded-full bg-surface-interactive px-3 text-secondary font-bold text-white outline-none disabled:opacity-50">
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v} className="bg-[#26262b]">{o.l}</option>
                ))}
              </select>
            </div>
          ))}
        </Group>
        {manage && (
          <button type="button" disabled={!dirty || busy} onClick={() => void save()}
            className="mt-4 h-11 w-full rounded-full bg-white text-[15px] font-extrabold text-black disabled:opacity-40">
            Save changes
          </button>
        )}

        {manage && (
          <>
            <div className="h-6" />
            <SectionLabel>Visibility</SectionLabel>
            <Group>
              <Toggle icon="search" label="Listed in Discover" value={c.listed} disabled={busy} onChange={(v) => void toggleListing(v)} />
            </Group>
            <Footnote>Nothing here goes public until you list it.</Footnote>
          </>
        )}

        <div className="h-6" />
        <SectionLabel>Moderate</SectionLabel>
        <Group>
          <Tile icon="usersGroupRounded" label="Open community: pins, library, reports" href={`/c/${encodeURIComponent(c.slug)}`} />
        </Group>
        <Footnote>Your staff role acts as admin or moderator inside this community. Moderation actions are recorded in the community&apos;s own log.</Footnote>
      </>
    );
  }

  return (
    <SettingsPage title={c?.name ?? "Community"} backHref="/admin/communities">
      {body}
      {toast}
    </SettingsPage>
  );
}
