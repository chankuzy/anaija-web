"use client";
import { UserRowsSkeleton } from "@/components/ui/skeleton";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ApiError } from "@/lib/api/client";
import { settingsApi, type BlockedUser } from "@/lib/api/settings";
import { useCached } from "@/lib/cache/swr";
import { Group, SettingsPage, useRequireAuth, useToast } from "./settings-kit";

export function BlockedView() {
  const ready = useRequireAuth();
  const { toast, show } = useToast();
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());

  // The list paints instantly from cache; a quiet revalidation reconciles it.
  const { data: users, error, refresh, mutate } = useCached<BlockedUser[]>(
    ready ? "settings:blocked" : null,
    () => settingsApi.blocked(),
    { staleMs: 60_000 },
  );

  async function unblock(u: BlockedUser) {
    if (busy.has(u.id)) return;
    setBusy((p) => new Set(p).add(u.id));
    try {
      await settingsApi.unblock(u.id);
      mutate((old) => old.filter((x) => x.id !== u.id));
      show(`Unblocked @${u.username ?? ""}`);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Couldn't unblock");
    } finally {
      setBusy((p) => {
        const n = new Set(p);
        n.delete(u.id);
        return n;
      });
    }
  }

  let body;
  if (!users && error) {
    body = (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-5 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg"
        >
          Try again
        </button>
      </div>
    );
  } else if (!users) {
    body = <UserRowsSkeleton />;
  } else if (users.length === 0) {
    body = (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">No blocked accounts</p>
        <p className="mt-1 text-body text-muted">People you block will show up here</p>
      </div>
    );
  } else {
    body = (
      <Group>
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar url={u.avatar} name={u.name ?? u.username} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-bold text-white">{u.name ?? ""}</p>
              <p className="truncate text-supporting text-muted">@{u.username ?? ""}</p>
            </div>
            <button
              type="button"
              disabled={busy.has(u.id)}
              onClick={() => void unblock(u)}
              className="h-9 rounded-full bg-surface-interactive px-4 text-supporting font-bold text-white transition hover:bg-surface-elevated disabled:opacity-50"
            >
              {busy.has(u.id) ? "…" : "Unblock"}
            </button>
          </div>
        ))}
      </Group>
    );
  }

  return (
    <SettingsPage title="Blocked accounts" backHref="/settings">
      {body}
      {toast}
    </SettingsPage>
  );
}
