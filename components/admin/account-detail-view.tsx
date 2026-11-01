"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { uploadBlob } from "@/lib/api/upload";
import {
  errMsg, platformApi, roleLabel,
  type AccountAdmin, type AccountDetail, type StaffLite,
} from "@/lib/api/platform";
import { cropSquare } from "@/lib/admin/crop-square";
import { revalidate, useCached } from "@/lib/cache/swr";
import { confirmDialog } from "@/lib/ui/dialog";
import { Footnote, Group, SectionLabel, SettingsPage, Toggle, useToast } from "@/components/settings/settings-kit";
import { StatusPill } from "./status-pill";

const inputCls =
  "h-12 w-full rounded-[18px] bg-surface-interactive px-4 text-[15px] text-white outline-none placeholder:text-muted disabled:opacity-60";

function AdminsSection({ accountKey, show }: { accountKey: string; show: (m: string) => void }) {
  const { data, refresh } = useCached<{ data: AccountAdmin[]; candidates: StaffLite[] }>(
    `admin:account:${accountKey}:admins`,
    () => platformApi.admins(accountKey),
    { staleMs: 15_000 },
  );
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(ad: AccountAdmin) {
    const ok = await confirmDialog({
      title: `Remove ${ad.name ?? ad.username ?? "this person"}?`,
      message: "They will no longer be able to act for this account.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) await run(() => platformApi.removeAdmin(accountKey, ad.user_id));
  }

  if (!data) return <SettingsGroupsSkeleton groups={1} rows={2} />;

  return (
    <>
      <SectionLabel>Who can act for this account</SectionLabel>
      <Group>
        {data.data.length === 0 && <p className="px-4 py-5 text-body text-muted">Nobody is assigned yet.</p>}
        {data.data.map((ad) => (
          <div key={ad.user_id}>
            <div className="flex items-center gap-3 px-4 pt-3">
              <Avatar url={ad.avatar} name={ad.name ?? ad.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-white">{ad.name ?? ad.username ?? `User ${ad.user_id}`}</p>
                <p className="truncate text-supporting text-muted">{ad.username ? `@${ad.username} · ` : ""}{roleLabel(ad.role)}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void remove(ad)} className="h-9 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-danger disabled:opacity-50">
                Remove
              </button>
            </div>
            <Toggle icon="letter" label="Can publish" value={ad.can_publish} disabled={busy}
              onChange={(v) => void run(() => platformApi.setAdmin(accountKey, { staff_user_id: ad.user_id, can_publish: v }))} />
            <Toggle icon="settings" label="Can manage" value={ad.can_manage} disabled={busy}
              onChange={(v) => void run(() => platformApi.setAdmin(accountKey, { staff_user_id: ad.user_id, can_manage: v }))} />
          </div>
        ))}
      </Group>

      {data.candidates.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <select
            aria-label="Assign staff"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-white outline-none"
          >
            <option value="" className="bg-[#26262b]">Assign a staff member…</option>
            {data.candidates.map((s) => (
              <option key={s.user_id} value={s.user_id} className="bg-[#26262b]">
                {(s.name ?? s.username ?? `User ${s.user_id}`)} · {roleLabel(s.role)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pick || busy}
            onClick={() => void run(async () => { await platformApi.setAdmin(accountKey, { staff_user_id: Number(pick) }); setPick(""); })}
            className="h-11 shrink-0 rounded-full bg-white px-5 text-secondary font-extrabold text-black disabled:opacity-40"
          >
            Assign
          </button>
        </div>
      )}
      <Footnote>Assigned staff can publish as this account. &quot;Can manage&quot; also lets them edit its profile.</Footnote>
    </>
  );
}

export function AccountDetailView() {
  const { key } = useParams<{ key: string }>();
  const { toast, show } = useToast();
  const { data: a, error, refresh } = useCached<AccountDetail>(
    `admin:account:${key}`,
    () => platformApi.account(key),
    { staleMs: 30_000 },
  );
  const [draft, setDraft] = useState<{ name?: string; bio?: string; tagline?: string }>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    await refresh();
    void revalidate("admin:accounts", () => platformApi.accounts());
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      show("Pick an image");
      return;
    }
    setUploading(true);
    try {
      const blob = await cropSquare(file);
      const path = await uploadBlob(blob, "avatar.jpg", "image/jpeg");
      await api.post(`platform/accounts/${encodeURIComponent(key)}/avatar`, { storage_key: path });
      await reload();
      show("Avatar updated");
    } catch (err) {
      show(err instanceof Error && !("status" in err) ? err.message : errMsg(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!a) return;
    const body: Record<string, string> = {};
    for (const k of ["name", "bio", "tagline"] as const) {
      const v = draft[k];
      if (v !== undefined && v !== (a[k] ?? "")) body[k] = v;
    }
    if (!Object.keys(body).length) return;
    setBusy(true);
    try {
      await platformApi.updateAccount(key, body);
      setDraft({});
      await reload();
      show("Saved");
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "activate" | "suspend" | "recover") {
    const copy = {
      activate: { title: "Make this account live?", message: "It becomes visible in the app and can start publishing.", label: "Activate", danger: false },
      suspend: { title: "Suspend this account?", message: "It disappears from the app until you recover it.", label: "Suspend", danger: true },
      recover: { title: "Recover this account?", message: "It returns to the state it had before suspension.", label: "Recover", danger: false },
    }[action];
    const ok = await confirmDialog({ title: copy.title, message: copy.message, confirmLabel: copy.label, danger: copy.danger });
    if (!ok) return;
    setBusy(true);
    try {
      await platformApi.setStatus(key, action);
      await reload();
      show("Done");
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (!a) {
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
    const name = draft.name ?? a.name ?? "";
    const bio = draft.bio ?? a.bio ?? "";
    const tagline = draft.tagline ?? a.tagline ?? "";
    const dirty = name !== (a.name ?? "") || bio !== (a.bio ?? "") || tagline !== (a.tagline ?? "");
    body = (
      <>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPickAvatar(e)} />
        <div className="mb-5 flex items-center gap-4 px-1.5">
          {a.can.edit ? (
            <button
              type="button"
              aria-label="Change avatar"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="relative shrink-0 rounded-full disabled:opacity-60"
            >
              <Avatar url={a.avatar} name={a.name ?? a.username} size={64} />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full bg-white text-black">
                {uploading ? <span className="text-micro font-bold">…</span> : <Icon name="camera" filled className="size-4" />}
              </span>
            </button>
          ) : (
            <Avatar url={a.avatar} name={a.name ?? a.username} size={64} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-white">{a.name ?? a.key}</p>
            <p className="truncate text-secondary text-muted">
              {a.username ? `@${a.username}` : a.key} · {a.followers.toLocaleString()} {a.followers === 1 ? "follower" : "followers"}
            </p>
          </div>
          <StatusPill status={a.status} />
        </div>

        <SectionLabel>Profile</SectionLabel>
        <Group>
          <div className="space-y-3 p-4">
            <input aria-label="Name" placeholder="Name" maxLength={60} value={name} disabled={!a.can.edit || busy}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputCls} />
            <input aria-label="Tagline" placeholder="Tagline" maxLength={80} value={tagline} disabled={!a.can.edit || busy}
              onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} className={inputCls} />
            <textarea aria-label="Bio" placeholder="Bio" maxLength={300} rows={4} value={bio} disabled={!a.can.edit || busy}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              className={`${inputCls} h-auto resize-none py-3 leading-[1.4]`} />
            {a.can.edit && (
              <button type="button" disabled={!dirty || busy || !name.trim()} onClick={() => void save()}
                className="h-11 w-full rounded-full bg-white text-[15px] font-extrabold text-black disabled:opacity-40">
                Save changes
              </button>
            )}
          </div>
        </Group>
        <Footnote>The handle can&apos;t be changed here.</Footnote>

        {a.can.status && (
          <>
            <div className="h-6" />
            <SectionLabel>Status</SectionLabel>
            <Group>
              <div className="p-4">
                {a.status === "provisioned" && (
                  <button type="button" disabled={busy} onClick={() => void act("activate")} className="h-11 w-full rounded-full bg-white text-[15px] font-extrabold text-black disabled:opacity-40">
                    Activate account
                  </button>
                )}
                {a.status === "active" && (
                  <button type="button" disabled={busy} onClick={() => void act("suspend")} className="h-11 w-full rounded-full bg-danger/15 text-[15px] font-extrabold text-danger disabled:opacity-40">
                    Suspend account
                  </button>
                )}
                {a.status === "suspended" && (
                  <button type="button" disabled={busy} onClick={() => void act("recover")} className="h-11 w-full rounded-full bg-white text-[15px] font-extrabold text-black disabled:opacity-40">
                    Recover account
                  </button>
                )}
              </div>
            </Group>
          </>
        )}

        {a.can.admins && (
          <>
            <div className="h-6" />
            <AdminsSection accountKey={key} show={show} />
          </>
        )}
      </>
    );
  }

  return (
    <SettingsPage title={a?.name ?? "Account"} backHref="/admin/accounts">
      {body}
      {toast}
    </SettingsPage>
  );
}
