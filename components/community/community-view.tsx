/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/settings/settings-kit";
import { useMessages } from "@/components/messaging/messages-context";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { AboutTab } from "./about-tab";
import { ChatTab } from "./chat-tab";
import { FeedTab } from "./feed-tab";
import { LibraryTab } from "./library-tab";
import { Empty, categoryLabel, messageOf, useFetch } from "./kit";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "chat", label: "Chat" },
  { id: "library", label: "Library" },
  { id: "about", label: "About" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Header({ c, busy, onJoin }: { c: CommunityDetail; busy: boolean; onJoin: () => void }) {
  const meta = [categoryLabel(c.category), c.course_code, `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ");
  let action: React.ReactNode = null;
  if (c.is_member) action = <span className="rounded-pill bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-fg">Joined</span>;
  else if (c.request_status === "pending") action = <span className="rounded-pill bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-muted">Requested</span>;
  else if (c.join_policy === "invite") action = <span className="rounded-pill bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-muted">Invite only</span>;
  else action = (
    <button type="button" disabled={busy} onClick={onJoin} className={buttonClass("primary", "h-10 px-5")}>
      {c.join_policy === "request" ? "Request to join" : "Join"}
    </button>
  );
  return (
    <div>
      <div className="relative h-[120px] overflow-hidden rounded-[22px] bg-gradient-to-br from-surface-interactive to-surface-subtle md:h-[160px]">
        {c.cover && <img src={c.cover} alt="" className="size-full object-cover" />}
      </div>
      <div className="-mt-9 flex items-end gap-3.5 px-3">
        <span className="rounded-full bg-bg p-1">
          <Avatar url={c.avatar} name={c.name} size={76} />
        </span>
        <span className="ml-auto pb-1">{action}</span>
      </div>
      <h1 className="mt-3 px-1 text-[24px] font-extrabold leading-[1.15] tracking-tight text-fg">{c.name}</h1>
      <p className="mt-1 px-1 text-secondary text-muted">{meta}</p>
    </div>
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
    <div className="mx-auto w-full max-w-[720px] px-4 pb-12 pt-3 md:pt-8">
      <Link href="/communities" aria-label="Communities" className="mb-3 inline-grid size-10 place-items-center rounded-full bg-surface-interactive text-fg">
        <Icon name="back" className="size-6" />
      </Link>
      <Header c={c} busy={busy} onJoin={() => void join()} />

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
        {tab === "chat" && <ChatTab c={c} onJoin={() => void join()} />}
        {tab === "library" && <LibraryTab c={c} onJoin={() => void join()} />}
        {tab === "about" && <AboutTab c={c} reload={det.reload} />}
      </div>
      {toast}
    </div>
  );
}
