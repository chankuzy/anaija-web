/* eslint-disable @next/next/no-img-element */
"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { uploadBlob } from "@/lib/api/upload";
import { errMsg, platformApi, type PlatformAccount } from "@/lib/api/platform";
import { platformContentApi, type ContentItem, type ContentMedia } from "@/lib/api/platform-content";
import { prepareImage } from "@/lib/admin/prepare-image";
import { put, useCached } from "@/lib/cache/swr";
import { confirmDialog } from "@/lib/ui/dialog";
import { Footnote, Group, SectionLabel, SettingsPage, Toggle, useToast } from "@/components/settings/settings-kit";
import { ContentStatusPill, fmtWhen } from "./content-status";
import { useStaff } from "./staff-context";

const MAX_MEDIA = 10;
const inputCls = "w-full rounded-[18px] bg-surface-interactive px-4 text-[15px] text-white outline-none placeholder:text-muted disabled:opacity-60";
const primary = "h-11 w-full rounded-full bg-white text-[15px] font-extrabold text-black disabled:opacity-40";
const secondary = "h-11 w-full rounded-full bg-surface-interactive text-[15px] font-bold text-white disabled:opacity-40";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const STAT_ROWS: [string, keyof NonNullable<ContentItem["stats"]>][] = [
  ["Impressions", "impressions"], ["Views", "views"], ["Completions", "completions"],
  ["Likes", "likes"], ["Comments", "comments"], ["Shares", "shares"],
  ["Saves", "saves"], ["Reposts", "reposts"], ["Follows", "follows_from"],
];

function ItemForm({ item, accounts, show }: { item: ContentItem | null; accounts: PlatformAccount[]; show: (m: string) => void }) {
  const router = useRouter();
  const [account, setAccount] = useState(item?.account?.key ?? "");
  const [caption, setCaption] = useState(item?.caption ?? "");
  const [visibility, setVisibility] = useState(item?.visibility ?? "public");
  const [comments, setComments] = useState(item?.allow_comments ?? true);
  const [media, setMedia] = useState<ContentMedia[]>(item?.media ?? []);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [when, setWhen] = useState(item?.scheduled_at ? toLocalInput(item.scheduled_at) : "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cacheKey = item ? `admin:content:item:${item.id}` : null;
  const published = item?.status === "published";
  const locked = item ? !item.can.edit : false;
  const mediaLocked = locked || published;
  const keysNow = media.map((m) => m.storage_key).join(",");
  const dirty = !item || caption !== item.caption || visibility !== item.visibility || comments !== item.allow_comments ||
    keysNow !== item.media.map((m) => m.storage_key).join(",");
  const acct = item?.account ?? accounts.find((a) => a.key === account) ?? null;
  const acctName = acct && "name" in acct ? acct.name : null;
  const acctUser = acct && "username" in acct ? acct.username : null;
  const acctAvatar = acct && "avatar" in acct ? acct.avatar : null;

  const body = () => ({
    caption, visibility, allow_comments: comments,
    media: media.map(({ url: _u, thumbnail_url: _t, ...rest }) => { void _u; void _t; return rest; }),
  });

  async function run(fn: () => Promise<ContentItem>, done: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (cacheKey) put(cacheKey, r);
      show(done);
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        if (media.length >= MAX_MEDIA) { show(`Up to ${MAX_MEDIA} images`); break; }
        if (!f.type.startsWith("image/")) { show("Images only for now"); continue; }
        const { blob, width, height } = await prepareImage(f);
        const path = await uploadBlob(blob, "post.jpg", "image/jpeg");
        const preview = URL.createObjectURL(blob);
        setPreviews((p) => ({ ...p, [path]: preview }));
        setMedia((m) => [...m, {
          type: "image", storage_key: path, width, height, size_bytes: blob.size, mime_type: "image/jpeg", aspect_ratio: width / height,
        }]);
      }
    } catch (err) {
      show(err instanceof Error && !("status" in err) ? err.message : errMsg(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!item) {
      if (!account) { show("Pick an account"); return; }
      setBusy(true);
      try {
        const r = await platformContentApi.create({ account, payload: body() });
        router.replace(`/admin/content/${r.id}`);
      } catch (e) {
        show(errMsg(e));
        setBusy(false);
      }
      return;
    }
    await run(() => platformContentApi.update(item.id, body()), "Saved");
  }

  async function schedule() {
    if (!item) return;
    if (!when) { show("Pick a date and time"); return; }
    await run(() => platformContentApi.schedule(item.id, new Date(when).toISOString()), "Scheduled");
  }

  async function publishNow() {
    if (!item) return;
    const ok = await confirmDialog({
      title: "Publish now?",
      message: `It goes live immediately as ${acctName ?? "this account"}.`,
      confirmLabel: "Publish",
    });
    if (ok) await run(() => platformContentApi.publish(item.id), "Published");
  }

  async function archive() {
    if (!item) return;
    const live = item.status === "published";
    const ok = await confirmDialog({
      title: live ? "Take this post down?" : "Archive this item?",
      message: live ? "It disappears from the app for everyone. This can't be undone." : "It moves to Archived.",
      confirmLabel: live ? "Take down" : "Archive",
      danger: true,
    });
    if (ok) await run(() => platformContentApi.archive(item.id), live ? "Taken down" : "Archived");
  }

  const first = media[0];
  const firstSrc = first ? (previews[first.storage_key] ?? first.url ?? null) : null;

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e)} />

      {item && (
        <div className="mb-4 flex items-center gap-3 px-1.5">
          <ContentStatusPill status={item.status} />
          <p className="min-w-0 flex-1 truncate text-secondary text-muted">
            {item.status === "scheduled" && item.scheduled_at ? `Goes live ${fmtWhen(item.scheduled_at)}`
              : item.status === "published" && item.published_at ? `Published ${fmtWhen(item.published_at)}`
              : `Edited ${fmtWhen(item.updated_at)}`}
          </p>
        </div>
      )}
      {item?.last_error && <p className="mb-4 rounded-[18px] bg-danger/15 px-4 py-3 text-secondary text-danger">{item.last_error}</p>}

      {!item && (
        <>
          <SectionLabel>Publish as</SectionLabel>
          <Group>
            <div className="p-4">
              <select aria-label="Account" value={account} onChange={(e) => setAccount(e.target.value)} className={`${inputCls} h-12`}>
                <option value="" className="bg-[#26262b]">Pick an account…</option>
                {accounts.filter((a) => a.status !== "suspended").map((a) => (
                  <option key={a.key} value={a.key} className="bg-[#26262b]">{a.name ?? a.key}</option>
                ))}
              </select>
            </div>
          </Group>
          <div className="h-6" />
        </>
      )}

      <SectionLabel>Content</SectionLabel>
      <Group>
        <div className="space-y-3 p-4">
          <textarea aria-label="Caption" placeholder="Write a caption…" rows={5} maxLength={2200} value={caption}
            disabled={locked || busy} onChange={(e) => setCaption(e.target.value)} className={`${inputCls} resize-none py-3 leading-[1.4]`} />
          <div className="flex flex-wrap gap-2">
            {media.map((m) => (
              <div key={m.storage_key} className="relative size-[88px] overflow-hidden rounded-2xl bg-card">
                <img src={previews[m.storage_key] ?? m.url ?? ""} alt="" className="size-full object-cover" />
                {!mediaLocked && (
                  <button type="button" aria-label="Remove image" onClick={() => setMedia((x) => x.filter((y) => y.storage_key !== m.storage_key))}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-[14px] font-bold text-white">
                    ×
                  </button>
                )}
              </div>
            ))}
            {!mediaLocked && media.length < MAX_MEDIA && (
              <button type="button" disabled={uploading || busy} onClick={() => fileRef.current?.click()}
                className="grid size-[88px] place-items-center rounded-2xl bg-surface-interactive text-white disabled:opacity-50">
                {uploading ? <span className="text-micro font-bold">…</span> : <Icon name="plus" className="size-7" />}
              </button>
            )}
          </div>
          <select aria-label="Audience" value={visibility} disabled={locked || busy} onChange={(e) => setVisibility(e.target.value)} className={`${inputCls} h-12`}>
            <option value="public" className="bg-[#26262b]">Everyone</option>
            <option value="followers" className="bg-[#26262b]">Followers</option>
            <option value="campus" className="bg-[#26262b]">Campus</option>
          </select>
        </div>
        <Toggle icon="chatLine" label="Allow comments" value={comments} disabled={locked || busy} onChange={setComments} />
      </Group>
      {published && <Footnote>Images can&apos;t be changed after publishing. Caption, audience and comments can.</Footnote>}
      {(!item || item.can.edit) && (
        <button type="button" disabled={busy || uploading || !dirty} onClick={() => void save()} className={`${primary} mt-4`}>
          {item ? "Save changes" : "Save draft"}
        </button>
      )}

      <div className="h-6" />
      <SectionLabel>Preview</SectionLabel>
      <div className="overflow-hidden rounded-[20px] bg-surface-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar url={acctAvatar} name={acctName ?? acctUser} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-white">{acctName ?? "Pick an account"}</p>
            {acctUser && <p className="truncate text-supporting text-muted">@{acctUser}</p>}
          </div>
        </div>
        {firstSrc && <img src={firstSrc} alt="" className="max-h-[420px] w-full bg-card object-contain" />}
        {media.length > 1 && <p className="px-4 pt-2 text-supporting text-muted">1 of {media.length}</p>}
        {caption.trim() ? (
          <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-[1.4] text-white">{caption}</p>
        ) : (
          <p className="px-4 py-3 text-body text-muted">No caption</p>
        )}
      </div>

      {item && item.can.publish && (
        <>
          <div className="h-6" />
          <SectionLabel>{item.status === "scheduled" ? "Schedule" : "Publish"}</SectionLabel>
          <Group>
            <div className="space-y-3 p-4">
              <input type="datetime-local" aria-label="Publish at" value={when} disabled={busy || dirty} onChange={(e) => setWhen(e.target.value)} className={`${inputCls} h-12`} />
              <button type="button" disabled={busy || dirty || !when} onClick={() => void schedule()} className={primary}>
                {item.status === "scheduled" ? "Reschedule" : "Schedule"}
              </button>
              {item.status === "scheduled" && (
                <button type="button" disabled={busy || dirty} onClick={() => void run(() => platformContentApi.unschedule(item.id), "Moved to drafts")} className={secondary}>
                  Unschedule
                </button>
              )}
              <button type="button" disabled={busy || dirty} onClick={() => void publishNow()} className={secondary}>
                Publish now
              </button>
            </div>
          </Group>
          {dirty && <Footnote>Save your changes first.</Footnote>}
          {acct && "status" in acct && acct.status !== "active" && <Footnote>This account isn&apos;t live yet, so publishing is blocked until you activate it.</Footnote>}
        </>
      )}
      {item && !item.can.publish && (item.status === "draft" || item.status === "scheduled") && (
        <Footnote>A comms admin schedules and publishes this.</Footnote>
      )}

      {item?.stats && (
        <>
          <div className="h-6" />
          <SectionLabel>Performance</SectionLabel>
          <Group>
            <div className="grid grid-cols-3 gap-px bg-white/5">
              {STAT_ROWS.map(([label, k]) => (
                <div key={k} className="bg-surface-subtle px-4 py-3">
                  <p className="text-[17px] font-extrabold text-white">{item.stats![k].toLocaleString()}</p>
                  <p className="text-supporting text-muted">{label}</p>
                </div>
              ))}
            </div>
          </Group>
          <Footnote>Impressions and completions come from the feed engine and can lag by a few minutes.</Footnote>
        </>
      )}

      {item && item.can.archive && (
        <>
          <div className="h-6" />
          <button type="button" disabled={busy} onClick={() => void archive()} className="h-11 w-full rounded-full bg-danger/15 text-[15px] font-extrabold text-danger disabled:opacity-40">
            {item.status === "published" ? "Take down" : "Archive"}
          </button>
        </>
      )}
    </>
  );
}

export function ContentEditor({ id }: { id: number | null }) {
  const staff = useStaff();
  const { toast, show } = useToast();
  const accounts = useCached<PlatformAccount[]>("admin:accounts", () => platformApi.accounts(), { staleMs: 60_000 });
  const itemQ = useCached<ContentItem>(id ? `admin:content:item:${id}` : null, () => platformContentApi.get(id as number), { staleMs: 15_000 });
  if (!id && !staff.can("content.write")) notFound();

  const item = itemQ.data ?? null;
  let body;
  if (id && !item) {
    body = itemQ.error ? (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{itemQ.error}</p>
        <button type="button" onClick={() => void itemQ.refresh()} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-extrabold text-black">
          Try again
        </button>
      </div>
    ) : (
      <SettingsGroupsSkeleton groups={2} rows={3} />
    );
  } else {
    body = <ItemForm key={item ? `${item.id}:${item.updated_at}` : "new"} item={item} accounts={accounts.data ?? []} show={show} />;
  }

  return (
    <SettingsPage title={id ? "Content" : "New content"} backHref="/admin/content">
      {body}
      {toast}
    </SettingsPage>
  );
}

export function ContentItemRoute() {
  const { id } = useParams<{ id: string }>();
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  return <ContentEditor id={n} />;
}
