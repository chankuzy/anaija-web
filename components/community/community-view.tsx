/* eslint-disable @next/next/no-img-element */
"use client";

import { openAuth } from "@/lib/auth/auth-modal";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { ImageCropper } from "@/components/settings/image-cropper";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { uploadBlob } from "@/lib/api/upload";
import { useAuth } from "@/lib/auth/auth-context";
import { noteVisit } from "@/lib/community/recent";
import { AboutTab } from "./about-tab";
import { useToast } from "./cm-kit";
import { CommunityMenu } from "./community-menu";
import { FeedTab } from "./feed-tab";
import { Cm, DesigBadge, Empty, ImageViewer, ROLE_LABEL, Sheet, categoryLabel, messageOf, useFetch } from "./kit";
import { LibraryTab } from "./library-tab";
import { MembersTab } from "./members-tab";
import { SessionsTab } from "./sessions-tab";
import { TabPager } from "./tab-pager";

const TABS = [
  { id: "feed", label: "Feed", icon: "feed" },
  { id: "library", label: "Library", icon: "notebookMinimalistic" },
  { id: "sessions", label: "Sessions", icon: "eyeClosed" },
  { id: "members", label: "Members", icon: "usersGroupRounded" },
] as const;
type TabId = (typeof TABS)[number]["id"];
type Kind = "cover" | "avatar";

const first = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || "Someone";

function Faces({ c }: { c: CommunityDetail }) {
  const faces = c.face_pile ?? [];
  if (!faces.length) return null;
  const names = faces.slice(0, 2).map((f) => first(f.name));
  const rest = Math.max(0, c.members_count - names.length);
  const label = rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(" and ");
  return (
    <div className="mt-3 flex items-center gap-3 px-1">
      <span className="flex">
        {faces.map((f, i) => (
          <span key={f.id} className={`rounded-full ring-2 ring-bg ${i > 0 ? "-ml-2.5" : ""}`}>
            <Avatar url={f.avatar} name={f.name ?? "?"} size={26} />
          </span>
        ))}
      </span>
      <span className="min-w-0 truncate text-supporting text-muted">{label}</span>
    </div>
  );
}

// Identity header. Cover keeps the crop's own 8:3 ratio on phones (so nothing is cut), a fixed compact height from md up,
// and the same radius token Home gives post media. The 84px avatar sits half over the cover on a bg-coloured ring.
function Header({ c, cover, avatar, saving, joining, onJoin, onMenu, onView, onAbout }: {
  c: CommunityDetail; cover: string | null; avatar: string | null; saving: Kind | null; joining: boolean;
  onJoin: () => void; onMenu: () => void; onView: (url: string) => void; onAbout: () => void;
}) {
  const meta = [categoryLabel(c.category), c.course_code, `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ");
  const spinner = <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />;
  const pill = "inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-interactive px-3.5 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated";

  let join: ReactNode = null;
  if (!c.is_member) {
    if (c.request_status === "pending") join = <span className="px-2 text-secondary font-semibold text-muted">Requested</span>;
    else if (c.join_policy === "invite") join = <span className="px-2 text-secondary font-semibold text-muted">Invite only</span>;
    else join = (
      <button type="button" disabled={joining} onClick={onJoin} className={buttonClass("primary", "h-10 px-6 text-secondary")}>
        {c.join_policy === "request" ? "Request to join" : "Join"}
      </button>
    );
  }

  return (
    <div>
      <div className="relative aspect-[8/3] overflow-hidden rounded-image bg-surface-interactive md:aspect-auto md:h-[168px]">
        {cover && <img src={cover} alt="" className="size-full object-cover" />}
        {cover && <button type="button" aria-label="View cover" onClick={() => onView(cover)} className="absolute inset-0 cursor-zoom-in" />}
        <Link href="/communities" aria-label="Communities" className="absolute left-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-95">
          <Icon name="back" className="size-5" />
        </Link>
        <button type="button" aria-label="Community menu" onClick={onMenu} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform active:scale-95">
          <Icon name="dots" filled className="size-5" />
        </button>
        {saving === "cover" && <div className="absolute inset-0 grid place-items-center bg-black/40">{spinner}</div>}
      </div>

      <div className="flex items-center gap-3 px-1">
        <span className="relative -mt-11 shrink-0 rounded-full bg-bg p-1">
          <button type="button" aria-label="View picture" disabled={!avatar} onClick={() => avatar && onView(avatar)} className="block rounded-full">
            <Avatar url={avatar} name={c.name} size={84} />
          </button>
          {saving === "avatar" && <span className="absolute inset-1 grid place-items-center rounded-full bg-black/45">{spinner}</span>}
        </span>
        <span className="flex-1" />
        {join}
      </div>

      <div className="px-1 pt-1">
        <h1 className="text-[22px] font-extrabold leading-[1.15] tracking-tight text-fg">{c.name}</h1>
        <p className="mt-1 truncate text-secondary text-muted">{meta}</p>
        {c.description && <p className="mt-2 line-clamp-2 text-secondary leading-[1.45] text-fg/80">{c.description}</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        {c.is_member && c.my_role && c.my_role !== "member" && (
          <span className="inline-flex h-9 items-center rounded-full bg-brand/15 px-3.5 text-secondary font-extrabold text-brand-ink">{ROLE_LABEL[c.my_role]}</span>
        )}
        {c.is_member && c.my_designations.map((d, i) => <DesigBadge key={i} d={d} />)}
        {c.is_member && c.chat_conversation_id && (
          <Link href={`/c/${c.slug}/chat`} className={pill}><Icon name="message" className="size-4" />Chat</Link>
        )}
        <button type="button" onClick={onAbout} className={pill}><Icon name="usersGroupRounded" className="size-4" />About</button>
      </div>
      <Faces c={c} />
    </div>
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
  const anchor = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement | null>(null);
  const idxRef = useRef(0);
  const [joining, setJoining] = useState(false);
  const [menu, setMenu] = useState(false);
  const [about, setAbout] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ kind: Kind; file: File } | null>(null);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [local, setLocal] = useState<Partial<Record<Kind, string>>>({});
  const q = sp.get("tab");
  // Legacy links: ?tab=moments lives in Sessions now, ?tab=about opens the About sheet.
  const tabId = q === "moments" ? "sessions" : q;
  const index = Math.max(0, TABS.findIndex((t) => t.id === tabId));
  idxRef.current = index;
  const det = useFetch(status === "loading" ? null : `c:${slug}:${status}`, () => communitiesApi.show(slug));
  const c = det.data;

  const indRef = useCallback((el: HTMLSpanElement | null) => {
    ind.current = el;
    if (el) el.style.transform = `translateX(${idxRef.current * 100}%)`;
  }, []);
  const onProgress = useCallback((p: number) => {
    if (ind.current) ind.current.style.transform = `translateX(${p * 100}%)`;
  }, []);

  useEffect(() => {
    if (q === "chat") router.replace(`/c/${slug}/chat`);
    if (q === "about") {
      setAbout(true);
      router.replace(`/c/${slug}`, { scroll: false });
    }
  }, [q, slug, router]);

  const cSlug = c?.slug;
  const cName = c?.name;
  const cAvatar = c?.avatar ?? null;
  useEffect(() => {
    if (cSlug && cName) noteVisit({ slug: cSlug, name: cName, avatar: cAvatar });
  }, [cSlug, cName, cAvatar]);

  // Optimistic: the UI flips immediately, the server confirms, any failure rolls back.
  async function join() {
    if (!c) return;
    if (status !== "authed") return openAuth();
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
      det.reload();
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
      det.patch(() => r);
      show(kind === "cover" ? "Cover updated" : "Picture updated");
    } catch (e) {
      show(e instanceof Error && e.message.startsWith("The server") ? e.message : messageOf(e));
    } finally {
      setLocal((l) => ({ ...l, [kind]: undefined }));
      setSaving(null);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  }

  const go = (id: TabId) => router.replace(id === "feed" ? `/c/${slug}` : `/c/${slug}?tab=${id}`, { scroll: false });
  // After a swipe settles, never leave the reader stranded below a shorter tab.
  const settle = (i: number) => {
    go(TABS[i].id);
    const el = anchor.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };

  if (!c) {
    return (
      <Cm>
        <div className="mx-auto w-full max-w-[720px] px-3 pt-3 md:pt-8">
          {det.error ? (
            <Empty title={det.error.includes("banned") || det.error.includes("can't access") ? "You can't access this community" : det.error.includes("internet") ? "You're offline" : "Community not found"} body={det.error}>
              <Link href="/communities" className={buttonClass("primary", "h-10 px-5")}>Browse communities</Link>
            </Empty>
          ) : (
            <div role="status" aria-busy="true" aria-label="Loading community" className="space-y-4">
              <Sk className="aspect-[8/3] w-full rounded-image" />
              <Sk className="h-6 w-56 rounded-full" />
              <Sk className="h-4 w-72 rounded-full" />
            </div>
          )}
        </div>
      </Cm>
    );
  }

  // Below lg the page is one column capped like Home's (it only ever fills a phone); from lg the feed column takes
  // all the space the About sidebar leaves.
  return (
    <Cm>
      <div className="mx-auto w-full max-w-[720px] px-3 pb-28 pt-3 md:pt-8 lg:max-w-[1040px]">
        <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ kind: "cover", file: f }); e.target.value = ""; }} />
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCrop({ kind: "avatar", file: f }); e.target.value = ""; }} />

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
          <div className="min-w-0">
            <Header
              c={c}
              cover={local.cover ?? c.cover}
              avatar={local.avatar ?? c.avatar}
              saving={saving}
              joining={joining}
              onJoin={() => void join()}
              onMenu={() => setMenu(true)}
              onView={setViewer}
              onAbout={() => setAbout(true)}
            />

            <div ref={anchor} className="mt-5" />
            <div className="sticky top-0 z-10 -mx-3 border-b border-line bg-bg/95 px-3 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div className="relative grid grid-cols-4">
                {TABS.map((t, i) => {
                  const on = i === index;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => go(t.id)}
                      className={`flex h-12 items-center justify-center gap-1.5 text-secondary font-bold transition-colors ${on ? "text-fg" : "text-muted hover:text-fg"}`}
                    >
                      <Icon name={t.icon} filled={on} className="size-[19px] max-[400px]:hidden" />
                      {t.label}
                    </button>
                  );
                })}
                <span ref={indRef} aria-hidden="true" className="absolute -bottom-px left-0 w-1/4 will-change-transform">
                  <span className="mx-auto block h-0.5 w-10 rounded-full bg-brand" />
                </span>
              </div>
            </div>

            <TabPager
              index={index}
              count={TABS.length}
              onChange={settle}
              onProgress={onProgress}
              render={(i) => {
                const id = TABS[i].id;
                return id === "feed" ? <FeedTab c={c} onOpenSessions={() => go("sessions")} />
                  : id === "library" ? <LibraryTab c={c} onJoin={() => void join()} />
                  : id === "sessions" ? <SessionsTab c={c} seg0={q === "moments" ? "moments" : "sessions"} onJoin={() => void join()} />
                  : <MembersTab c={c} onJoin={() => void join()} />;
              }}
            />
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 max-h-[calc(100dvh-48px)] overflow-y-auto pt-4 no-scrollbar">
              <AboutTab c={c} />
            </div>
          </aside>
        </div>

        {menu && (
          <CommunityMenu
            c={c}
            reload={det.reload}
            onClose={() => setMenu(false)}
            onToast={show}
            onEditImage={(k) => (k === "cover" ? coverRef : avatarRef).current?.click()}
          />
        )}
        {about && <Sheet title="About" onClose={() => setAbout(false)} wide><AboutTab c={c} /></Sheet>}
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
    </Cm>
  );
}
