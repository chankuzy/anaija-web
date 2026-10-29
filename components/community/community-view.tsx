/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/settings/settings-kit";
import { useMessages } from "@/components/messaging/messages-context";
import { Avatar } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/settings/image-cropper";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { uploadBlob } from "@/lib/api/upload";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { prepareImage } from "@/lib/create/image-pipeline";
import { AboutTab } from "./about-tab";
import { FeedTab } from "./feed-tab";
import { LibraryTab } from "./library-tab";
import { Empty, categoryLabel, messageOf, useFetch } from "./kit";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "library", label: "Library" },
  { id: "about", label: "About" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Local = { url: string; from: string | null } | null;
// A local preview only counts while the server still has the old picture; once it changes, the server wins.
const photo = (server: string | null, local: Local) => (local && local.from === server ? local.url : server);

function Header({ c, busy, onJoin, onChanged, onToast }: { c: CommunityDetail; busy: boolean; onJoin: () => void; onChanged: () => void; onToast: (m: string) => void }) {
  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<"cover" | "avatar" | null>(null);
  const [localCover, setLocalCover] = useState<Local>(null);
  const [localAvatar, setLocalAvatar] = useState<Local>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const edit = c.can.manage;
  const cover = photo(c.cover, localCover);
  const avatar = photo(c.avatar, localAvatar);
  const meta = [categoryLabel(c.category), c.course_code, `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ");

  async function change(kind: "cover" | "avatar", file: File | undefined) {
    if (!file || saving) return;
    const setLocal = kind === "cover" ? setLocalCover : setLocalAvatar;
    setLocal({ url: URL.createObjectURL(file), from: kind === "cover" ? c.cover : c.avatar });
    setSaving(kind);
    try {
      const p = await prepareImage(file);
      const key = await uploadBlob(p.feed, `${kind}.${p.ext}`, p.contentType);
      await communitiesApi.update(c.id, kind === "cover" ? { cover_key: key } : { avatar_key: key });
      onChanged();
      window.setTimeout(() => setLocal(null), 8000);
    } catch (e) {
      setLocal(null);
      onToast(messageOf(e));
    } finally {
      setSaving(null);
    }
  }

  let action: React.ReactNode = null;
  if (c.is_member) action = <span className="rounded-pill bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-fg">Joined</span>;
  else if (c.request_status === "pending") action = <span className="rounded-pill bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-muted">Requested</span>;
  else if (c.join_policy === "invite") action = <span className="rounded-pill bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-muted">Invite only</span>;
  else action = (
    <button type="button" disabled={busy} onClick={onJoin} className={buttonClass("primary", "h-10 px-5")}>
      {c.join_policy === "request" ? "Request to join" : "Join"}
    </button>
  );

  const spinner = <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />;
  return (
    <div>
      <div className="relative h-[150px] overflow-hidden rounded-[26px] bg-gradient-to-br from-surface-interactive to-surface-subtle md:h-[200px]">
        {cover && <img src={cover} alt="" className="size-full object-cover" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/25" />
        <Link href="/communities" aria-label="Communities" className="absolute left-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-95">
          <Icon name="back" className="size-6" />
        </Link>
        {edit && (
          <>
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { setCropFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <button
              type="button"
              disabled={!!saving}
              onClick={() => coverRef.current?.click()}
              className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3.5 text-secondary font-bold text-white backdrop-blur-md transition-transform active:scale-95 disabled:opacity-60"
            >
              <Icon name="gallery" className="size-4" />
              {cover ? "Edit cover" : "Add cover"}
            </button>
          </>
        )}
        {cropFile && (
          <ImageCropper
            file={cropFile}
            spec={{ aspect: 8 / 3, circle: false, title: "Community cover", outW: 1200, viewW: 640 }}
            onCancel={() => setCropFile(null)}
            onDone={(b) => {
              setCropFile(null);
              void change("cover", new File([b], "cover.jpg", { type: "image/jpeg" }));
            }}
          />
        )}
        {saving === "cover" && <div className="absolute inset-0 grid place-items-center bg-black/40">{spinner}</div>}
      </div>

      <div className="relative z-10 -mt-12 flex items-end gap-3.5 px-3">
        <span className="relative shrink-0 rounded-full bg-bg p-1.5">
          <Avatar url={avatar} name={c.name} size={84} />
          {saving === "avatar" && <span className="absolute inset-1.5 grid place-items-center rounded-full bg-black/45">{spinner}</span>}
          {edit && (
            <>
              <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => { void change("avatar", e.target.files?.[0]); e.target.value = ""; }} />
              <button
                type="button"
                aria-label="Change community picture"
                disabled={!!saving}
                onClick={() => avatarRef.current?.click()}
                className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-brand text-brand-fg ring-[3px] ring-bg transition-transform active:scale-90 disabled:opacity-60"
              >
                <Icon name="gallery" className="size-4" />
              </button>
            </>
          )}
        </span>
        <span className="ml-auto pb-2">{action}</span>
      </div>
      <h1 className="mt-3 px-3 text-[24px] font-extrabold leading-[1.15] tracking-tight text-fg">{c.name}</h1>
      <p className="mt-1 px-3 text-secondary text-muted">{meta}</p>
    </div>
  );
}

// Members only, and only when the community actually has a chat conversation.
function ChatFab({ slug }: { slug: string }) {
  return (
    <Link
      href={`/c/${slug}/chat`}
      aria-label="Open community chat"
      className="fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-brand text-brand-fg shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 md:right-8"
      style={{ bottom: "calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 16px)" }}
    >
      <Icon name="message" filled className="size-6" />
    </Link>
  );
}

export function CommunityView({ slug }: { slug: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { status } = useAuth();
  const { reloadInbox } = useMessages();
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const q = sp.get("tab");
  const tab: TabId = TABS.some((t) => t.id === q) ? (q as TabId) : "feed";
  const det = useFetch(status === "loading" ? null : `c:${slug}:${status}`, () => communitiesApi.show(slug));
  const c = det.data;

  // Chat is no longer a tab; old links (?tab=chat) land in the dedicated chat screen.
  useEffect(() => {
    if (q === "chat") router.replace(`/c/${slug}/chat`);
  }, [q, slug, router]);

  async function join() {
    if (!c) return;
    if (status !== "authed") return router.push(loginHref());
    setBusy(true);
    try {
      const r = await communitiesApi.join(c.id);
      show(r.status === "joined" || r.status === "already_member" ? `Welcome to ${c.name}` : "Request sent. You'll be notified.");
      det.reload();
      reloadInbox();
    } catch (e) {
      show(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const setTab = (id: TabId) => router.replace(id === "feed" ? `/c/${slug}` : `/c/${slug}?tab=${id}`, { scroll: false });

  if (!c) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 pt-3 md:pt-8">
        {det.error ? (
          <Empty title={det.error.includes("banned") || det.error.includes("can't access") ? "You can't access this community" : "Community not found"} body={det.error}>
            <Link href="/communities" className={buttonClass("primary", "h-10 px-5")}>Browse communities</Link>
          </Empty>
        ) : (
          <div role="status" aria-busy="true" aria-label="Loading community" className="space-y-4">
            <Sk className="h-[140px] w-full rounded-[22px]" />
            <Sk className="h-6 w-56 rounded-full" />
            <Sk className="h-4 w-72 rounded-full" />
            <Sk className="h-40 w-full rounded-[22px]" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-28 pt-3 md:pt-8">
      <Header c={c} busy={busy} onJoin={() => void join()} onChanged={det.reload} onToast={show} />

      <div className="sticky top-0 z-10 -mx-4 mt-4 bg-bg px-4 py-2" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <div className="flex gap-1 rounded-full bg-surface-subtle p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-10 flex-1 rounded-full text-secondary font-bold transition-colors ${tab === t.id ? "bg-surface-elevated text-fg" : "text-muted hover:text-fg"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {tab === "feed" && <FeedTab c={c} />}
        {tab === "library" && <LibraryTab c={c} onJoin={() => void join()} />}
        {tab === "about" && <AboutTab c={c} reload={det.reload} />}
      </div>

      {c.is_member && c.chat_conversation_id && <ChatFab slug={slug} />}
      {toast}
    </div>
  );
}
