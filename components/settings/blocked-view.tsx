"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ApiError } from "@/lib/api/client";
import { settingsApi, type BlockedUser } from "@/lib/api/settings";
import { Group, SettingsPage, useRequireAuth, useToast } from "./settings-kit";

export function BlockedView() {
  const ready = useRequireAuth();
  const { toast, show } = useToast();
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const ac = new AbortController();
    settingsApi
      .blocked(ac.signal)
      .then((l) => {
        if (ac.signal.aborted) return;
        setUsers(l);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(e instanceof ApiError ? e.message : "Something went wrong.");
      });
    return () => ac.abort();
  }, [ready, nonce]);

  async function unblock(u: BlockedUser) {
    if (busy.has(u.id)) return;
    setBusy((p) => new Set(p).add(u.id));
    try {
      await settingsApi.unblock(u.id);
      setUsers((p) => p?.filter((x) => x.id !== u.id) ?? p);
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
  if (users === null && error) {
    body = (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black"
        >
          Try again
        </button>
      </div>
    );
  } else if (users === null) {
    body = <p className="py-16 text-center text-body text-muted">Loading…</p>;
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
              className="h-9 rounded-full border border-white/28 px-4 text-supporting font-bold text-white transition hover:bg-white/8 disabled:opacity-50"
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
