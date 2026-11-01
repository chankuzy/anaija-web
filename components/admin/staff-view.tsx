"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { STAFF_ROLES, errMsg, platformApi, roleLabel, type StaffMember } from "@/lib/api/platform";
import { useCached } from "@/lib/cache/swr";
import { confirmDialog } from "@/lib/ui/dialog";
import { Footnote, Group, SectionLabel, SettingsPage, useToast } from "@/components/settings/settings-kit";
import { useStaff } from "./staff-context";

const selectCls = "h-10 rounded-full bg-surface-interactive px-3 text-secondary font-bold text-white outline-none disabled:opacity-50";

export function StaffView() {
  const me = useStaff();
  if (!me.can("staff.manage")) notFound();

  const { toast, show } = useToast();
  const { data, error, refresh } = useCached<StaffMember[]>("admin:staff", () => platformApi.staff(), { staleMs: 15_000 });
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<string>("editor");

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (done) show(done);
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(s: StaffMember) {
    const ok = await confirmDialog({
      title: `Remove ${s.name ?? s.username ?? "this person"} from staff?`,
      message: "They lose all platform access and their account assignments.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) await run(() => platformApi.revokeStaff(s.user_id), "Removed");
  }

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
        <SectionLabel>Platform staff</SectionLabel>
        <Group>
          {data.map((s) => {
            const self = s.user_id === me.user_id;
            return (
              <div key={s.user_id} className="flex items-center gap-3 px-4 py-3">
                <Avatar url={s.avatar} name={s.name ?? s.username} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-white">{s.name ?? s.username ?? `User ${s.user_id}`}</p>
                  <p className="truncate text-supporting text-muted">{s.username ? `@${s.username}` : ""}{self ? " · you" : ""}</p>
                </div>
                <select aria-label="Role" value={s.role} disabled={busy || self} className={selectCls}
                  onChange={(e) => void run(() => platformApi.setStaffRole(s.user_id, e.target.value), "Role updated")}>
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-[#26262b]">{roleLabel(r)}</option>
                  ))}
                </select>
                {!self && (
                  <button type="button" disabled={busy} onClick={() => void revoke(s)} className="h-10 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-danger disabled:opacity-50">
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </Group>

        <div className="h-6" />
        <SectionLabel>Add staff</SectionLabel>
        <Group>
          <div className="space-y-3 p-4">
            <input aria-label="Username" placeholder="Username" value={username} disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 w-full rounded-[18px] bg-surface-interactive px-4 text-[15px] text-white outline-none placeholder:text-muted" />
            <select aria-label="Role" value={role} disabled={busy} onChange={(e) => setRole(e.target.value)} className={`${selectCls} w-full`}>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r} className="bg-[#26262b]">{roleLabel(r)}</option>
              ))}
            </select>
            <button type="button" disabled={busy || !username.trim()}
              onClick={() => void run(async () => { await platformApi.grantStaff({ username: username.trim(), role }); setUsername(""); }, "Added")}
              className="h-11 w-full rounded-full bg-white text-[15px] font-extrabold text-black disabled:opacity-40">
              Add to staff
            </button>
          </div>
        </Group>
        <Footnote>Only people with an ordinary account can be added. You can&apos;t change your own role, and at least one super admin must remain.</Footnote>
      </>
    );
  }

  return (
    <SettingsPage title="Staff" backHref="/admin/accounts">
      {body}
      {toast}
    </SettingsPage>
  );
}
