/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { ImageCropper } from "@/components/settings/image-cropper";
import { useToast } from "@/components/settings/settings-kit";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { uploadBlob } from "@/lib/api/upload";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { AboutTab } from "./about-tab";
import { CommunityMenu } from "./community-menu";
import { FeedTab } from "./feed-tab";
import { Empty, ImageViewer, categoryLabel, messageOf, useFetch } from "./kit";
import { LibraryTab } from "./library-tab";
import { MembersSheet } from "./members-sheet";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "library", label: "Library" },
  { id: "about", label: "About" },
] as const;
type TabId = (typeof TABS)[number]["id"];
type Kind = "cover" | "avatar";

const first = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "Someone";

function Faces({ c, onOpen }: { c: CommunityDetail; onOpen: () => void }) {
  const faces = c.face_pile ?? [];
  if (!faces.length) return null;
  const names = faces.slice(0, 2).map((f) => first(f.name));
  const rest = Math.max(0, c.members_count - names.length);
  const label = rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(" and ");
  const Wrap = c.is_member ? "button" : "div";
  return (
    <Wrap {...(c.is_member ? { type: "button" as const, onClick: onOpen } : {})} className="mt-3 flex items-center gap-3 px-3 text-left">
      <span className="flex">
        {faces.map((f, i) => (
          <span key={f.id} className={`rounded-full ring-2 ring-bg ${i > 0 ? "-ml-2.5" : ""}`}>
            <Avatar url={f.avatar} name={f.name ?? "?"} size={28} />
          </span>
        ))}
      </span>
      <span className="min-w-0 truncate text-supporting text-muted">{label}</span>
    </Wrap>
  );
}

function Header({ c, cover, avatar, saving, joining, onJoin, onMenu, onView, onMembers }: {
  c: CommunityDetail; cover: string | null; avatar: string | null; saving: Kind | null; joining: boolean;
  onJoin: () => void; onMenu: () => void; onView: (url: string) => void; onMembers: () => void;
}) {
  const meta = [categoryLabel(c.category), c.course_code, `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ");
  const spinner = <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />;

  let action: React.ReactNode = null;
  if (c.is_member) action = null;
  else if (c.request_status === "pending") action = <span className="px-2 text-secondary font-semibold text-muted">Requested</span>;
  else if (c.join_policy === "invite") action = <span className="px-2 text-secondary font-semibold text-muted">Invite only</span>;
  else action = (
    <button type="button" disabled={joining} onClick={onJoin} className={buttonClass("primary", "h-10 px-6")}>
      {c.join_policy === "request" ? "Request to join" : "Join"}
    </button>
  );

  return (
    <div>
      <div className="relative h-[150px] overflow-hidden rounded-[26px] bg-gradient-to-br from-surface-interactive to-surface-subtle md:h-[200px]">
        {cover && <img src={cover} alt="" className="size-full object-cover" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/25" />
        {cover && <button type="button" aria-label="View cover" onClick={() => onView(cover)} className="absolute inset-0 cursor-zoom-in" />}
        <Link href="/communities" aria-label="Communities" className="absolute left-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-95">
          <Icon name="back" className="size-6" />
        </Link>
        <button type="button" aria-label="Community menu" onClick={onMenu} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-95">
          <Icon name="menuDots" className="size-6" />
        </button>
        {saving === "cover" && <div className="absolute inset-0 grid place-items-center bg-black/40">{spinner}</div>}
      </div>

      <div className="relative z-10 -mt-12 flex items-end gap-3.5 px-3">
        <span className="relative shrink-0 rounded-full bg-bg p-1.5">
          <button type="button" aria-label="View picture" disabled={!avatar} onClick={() => avatar && onView(avatar)} className="block rounded-full">
            <Avatar url={avatar} name={c.name} size={84} />
          </button>
          {saving === "avatar" && <span className="absolute inset-1.5 grid place-items-center rounded-full bg-black/45">{spinner}</span>}
        </span>
        <span className="ml-auto pb-2">{action}</span>
      </div>
      <h1 className="mt-3 px-3 text-[24px] font-extrabold leading-[1.15] tracking-tight text-fg">{c.name}</h1>
      <p className="mt-1 px-3 text-secondary text-muted">{meta}</p>
      <Faces c={c} onOpen={onMembers} />
    </div>
  );
}

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
  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [joining, setJoining] = useState(false);
  const [menu, setMenu] = useState(false);
  const [members, setMembers] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ kind: Kind; file: File } | null>(null);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [local, setLocal] = useState<Partial<Record<Kind, string>>>({});
  const q = sp.get("tab");
  const tab: TabId = TABS.some((t) => t.id === q) ? (q as TabId) : "feed";
  const det = useFetch(status === "loading" ? null : `c:${slug}:${status}`, () => communitiesApi.show(slug));
  const c = det.data;

  useEffect(() => {
    if (q === "chat") router.replace(`/c/${slug}/chat`);
  }, [q, slug, router]);

  // Optimistic: the UI flips immediately, the server confirms, any failure rolls back.
  async function join() {
    if (!c) return;
    if (status !== "authed") return router.push(loginHref());
    if (joining) return;
    const snap = c;
    setJoining(true);
    det.patch((d) =>
      d.join_policy === "open"
        ? { ...d, is_member: true, my_role: "member", members_count: d.members_count + 1, can: { ...d.can, read: true } }
        : { ...d, request_status: "pending" },
    );
    try {
      const r = await communitiesApi.join(c.id);
      show(r.status === "joined" || r.status === "already_member" ? `Welcome to ${c.name}` : "Request sent. You'll be notified.");
      det.reload(); // settles permissions and chat; the UI keeps showing the optimistic state meanwhile
      reloadInbox();
    } catch (e) {
      det.patch(() => snap);
      show(messageOf(e));
    } finally {
      setJoining(false);
    }
  }

  async function saveImage(kind: Kind, b: Blob) {
    if (!c) return;
    const url = URL.createObjectURL(b);
    setLocal((l) => ({ ...l, [kind]: url }));
    setSaving(kind);
    try {
      const key = await uploadBlob(b, `${kind}.jpg`, "image/jpeg");
      const r = await communitiesApi.update(c.id, kind === "cover" ? { cover_key: key } : { avatar_key: key });
      if (!(kind === "cover" ? r.cover : r.avatar)) throw new Error("The server did not keep the new image.");
      det.patch(() => r); // server truth straight from the update response, no refetch needed
      show(kind === "cover" ? "Cover updated" : "Picture updated");
    } catch (e) {
      show(e instanceof Error && e.message.startsWith("The server") ? e.message : messageOf(e));
    } finally {
      setLocal((l) => ({ ...l, [kind]: undefined }));
      setSaving(null);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
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
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-28 pt-3 md:pt-8">
      <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ kind: "cover", file: f }); e.target.value = ""; }} />
      <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ kind: "avatar", file: f }); e.target.value = ""; }} />

      <Header
        c={c}
        cover={local.cover ?? c.cover}
        avatar={local.avatar ?? c.avatar}
        saving={saving}
        joining={joining}
        onJoin={() => void join()}
        onMenu={() => setMenu(true)}
        onView={setViewer}
        onMembers={() => setMembers(true)}
      />

      <div className="sticky top-0 z-10 -mx-4 mt-5 border-b border-white/[0.07] bg-bg px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex gap-7">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`relative h-11 text-secondary font-bold transition-colors ${tab === t.id ? "text-fg" : "text-muted hover:text-fg"}`}>
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {tab === "feed" && <FeedTab c={c} />}
        {tab === "library" && <LibraryTab c={c} onJoin={() => void join()} />}
        {tab === "about" && <AboutTab c={c} />}
      </div>

      {c.is_member && c.chat_conversation_id && <ChatFab slug={slug} />}

      {menu && (
        <CommunityMenu
          c={c}
          reload={det.reload}
          onClose={() => setMenu(false)}
          onToast={show}
          onEditImage={(k) => (k === "cover" ? coverRef : avatarRef).current?.click()}
        />
      )}
      {members && <MembersSheet c={c} onClose={() => setMembers(false)} />}
      {viewer && <ImageViewer src={viewer} onClose={() => setViewer(null)} />}
      {crop && (
        <ImageCropper
          file={crop.file}
          spec={crop.kind === "cover"
            ? { aspect: 8 / 3, circle: false, title: "Community cover", outW: 1200, viewW: 640 }
            : { aspect: 1, circle: true, title: "Community picture", outW: 512, viewW: 320 }}
          onCancel={() => setCrop(null)}
          onDone={(b) => { const k = crop.kind; setCrop(null); void saveImage(k, b); }}
        />
      )}
      {toast}
    </div>
  );
}
