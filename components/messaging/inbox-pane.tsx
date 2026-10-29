"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { OnlineDot } from "@/components/ui/online-dot";
import { mediaUrl } from "@/lib/api/feed";
import { asUtc, convAvatar, convName, isPending, previewMeta, type Conversation, type PreviewKind } from "@/lib/api/messaging";
import type { StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { useOnline } from "@/lib/realtime/presence";
import { useMessages } from "./messages-context";
import { RingAvatar } from "./ring-avatar";
import { StoriesTray } from "./stories-tray";
import { StoryViewer } from "./story-viewer";

const NOUN: Record<Exclude<PreviewKind, "text" | "listing">, string> = {
  photo: "a photo", video: "a video", voice: "a voice message", sticker: "a sticker", post: "a post", reel: "a reel", file: "a file",
};
const SHORT: Record<Exclude<PreviewKind, "text" | "listing">, string> = {
  photo: "Photo", video: "Video", voice: "Voice message", sticker: "Sticker", post: "Post", reel: "Reel", file: "File",
};

function describe(c: Conversation, myId?: number): { kind: PreviewKind; text: string } {
  const p = previewMeta(c, myId);
  if (p.kind === "text") return { kind: "text", text: p.who === "me" && p.text ? `You: ${p.text}` : p.text };
  if (p.kind === "listing") return { kind: "listing", text: p.text };
  if (p.who === "me") return { kind: p.kind, text: `You sent ${NOUN[p.kind]}` };
  if (p.who === "them") return { kind: p.kind, text: c.type === "group" ? `Sent ${NOUN[p.kind]}` : `${convName(c).split(" ")[0]} sent you ${NOUN[p.kind]}` };
  return { kind: p.kind, text: SHORT[p.kind] };
}

const PATHS: Partial<Record<PreviewKind, React.ReactNode>> = {
  photo: <><rect x="2" y="3.5" width="12" height="9" rx="2" /><circle cx="8" cy="8" r="2.2" /></>,
  video: <><rect x="2" y="4" width="8.5" height="8" rx="2" /><path d="M10.5 7.2 14 5v6l-3.5-2.2z" /></>,
  voice: <><rect x="6" y="2" width="4" height="7" rx="2" /><path d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14" /></>,
  reel: <><rect x="2.5" y="2.5" width="11" height="11" rx="3" /><path d="M6.8 5.8v4.4L10.6 8z" /></>,
  post: <><path d="M6.5 9.5l3-3M7 5l.8-.8a2.3 2.3 0 0 1 3.2 3.2l-.8.8M9 11l-.8.8a2.3 2.3 0 0 1-3.2-3.2L5.8 7.8" /></>,
  sticker: <><circle cx="8" cy="8" r="5.5" /><path d="M5.8 9.5a2.6 2.6 0 0 0 4.4 0" /><circle cx="6" cy="6.8" r=".6" /><circle cx="10" cy="6.8" r=".6" /></>,
  listing: <><path d="M3.5 5.5h9l-.7 7.5H4.2z" /><path d="M6 7V4.8a2 2 0 0 1 4 0V7" /></>,
  file: <><path d="M4.5 2h5l3 3v9h-8z" /><path d="M9.5 2v3h3" /></>,
};

function PreviewIcon({ kind }: { kind: PreviewKind }) {
  const g = PATHS[kind];
  if (!g) return null;
  return (
    <svg viewBox="0 0 16 16" className="size-[15px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {g}
    </svg>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(asUtc(iso));
  if (!t) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return new Date(t).toLocaleDateString("en-NG", { weekday: "short" });
  return new Date(t).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function Row({ c, active, ring, myId }: { c: Conversation; active: boolean; ring: boolean; myId?: number }) {
  const unread = c.unread_count > 0;
  const online = useOnline(c.type === "group" ? null : c.other_user?.id);
  const d = describe(c, myId);
  return (
    <Link href={`/messages/${c.id}`} className={`flex items-center gap-3.5 px-4 py-2.5 transition-colors ${active ? "bg-white/8" : "hover:bg-white/5"}`}>
      <span className="relative shrink-0">
        <RingAvatar url={convAvatar(c)} name={convName(c)} size={56} ring={ring} />
        {online && <OnlineDot size={13} className="absolute bottom-[3px] right-[3px]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-[15.5px] ${unread ? "font-extrabold text-white" : "font-semibold text-fg"}`}>{convName(c)}</span>
          <span className={`shrink-0 text-[11.5px] ${unread ? "font-bold text-brand" : "text-muted"}`}>{ago(c.last_message_at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={`flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] ${unread ? "font-semibold text-white/90" : "text-muted"}`}>
            {d.kind !== "text" && <PreviewIcon kind={d.kind} />}
            <span className="truncate">{d.text || "No messages yet"}</span>
          </span>
          {isPending(c) && <span className="shrink-0 text-supporting font-bold text-brand">Request</span>}
          {unread && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-brand-fg" aria-label={`${c.unread_count} unread`}>
              {c.unread_count > 99 ? "99+" : c.unread_count}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-2.5" aria-hidden="true">
      <span className="size-[66px] shrink-0 animate-pulse rounded-full bg-card" />
      <span className="flex-1 space-y-2">
        <span className="block h-3.5 w-32 animate-pulse rounded bg-card" />
        <span className="block h-3 w-48 animate-pulse rounded bg-card/70" />
      </span>
    </div>
  );
}

export function InboxPane({ activeId }: { activeId: number | null }) {
  const { user } = useAuth();
  const { conversations, inboxError, reloadInbox, groups, markStoriesSeen, ringFor } = useMessages();
  const [query, setQuery] = useState("");
  const [showReq, setShowReq] = useState(false);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);

  const all = conversations ?? [];
  const requests = useMemo(() => all.filter(isPending), [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return all.filter(
        (c) =>
          convName(c).toLowerCase().includes(q) ||
          (c.other_user?.username ?? "").toLowerCase().includes(q) ||
          (c.last_message_body ?? "").toLowerCase().includes(q),
      );
    }
    return showReq ? requests : all.filter((c) => !isPending(c));
  }, [all, query, showReq, requests]);

  const me = user ? { id: user.id, name: user.name, avatar: mediaUrl(user.avatar) } : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pb-2 pt-4">
        {showReq && !query ? (
          <div className="flex h-11 items-center gap-2">
            <button type="button" aria-label="Back to chats" onClick={() => setShowReq(false)} className="grid size-10 place-items-center rounded-full hover:bg-white/8">
              <Icon name="back" className="size-6" />
            </button>
            <h1 className="text-[17px] font-extrabold text-fg">Requests</h1>
          </div>
        ) : (
          <label className="flex h-11 items-center gap-2.5 rounded-full bg-surface-subtle px-4 text-muted transition-colors focus-within:bg-surface-interactive">
            <Icon name="search" className="size-[18px] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-muted"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-6 place-items-center rounded-full hover:bg-white/10">
                <Icon name="close" className="size-4" />
              </button>
            )}
          </label>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!query && !showReq && (
          <div className="pb-2 pt-1">
            <StoriesTray groups={groups} me={me} size={72} onOpen={(g, i) => setViewer({ groups: g, start: i })} />
          </div>
        )}

        {conversations === null && !inboxError && Array.from({ length: 7 }, (_, i) => <RowSkeleton key={i} />)}

        {inboxError && conversations === null && (
          <div className="px-6 py-16 text-center">
            <p className="text-[15px] font-bold text-fg">Couldn&apos;t load messages</p>
            <p className="mt-1 text-secondary text-muted">{inboxError}</p>
            <button type="button" onClick={reloadInbox} className="mt-5 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg">
              Try again
            </button>
          </div>
        )}

        {conversations && !showReq && !query && requests.length > 0 && (
          <button type="button" onClick={() => setShowReq(true)} className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/5">
            <span className="grid size-[56px] place-items-center rounded-full bg-brand/15 text-brand">
              <Icon name="user" filled className="size-6" />
            </span>
            <span className="flex-1">
              <span className="block text-[15.5px] font-bold text-fg">Message requests</span>
              <span className="block text-[13.5px] font-bold text-brand">{requests.length === 1 ? "1 new request" : `${requests.length} new requests`}</span>
            </span>
            <Icon name="chevronRight" className="size-4 text-muted" />
          </button>
        )}

        {conversations && list.length === 0 && (
          <div className="px-8 py-16 text-center">
            <p className="text-[15px] font-bold text-fg">{query ? "Nothing found" : showReq ? "No requests" : "No messages yet"}</p>
            <p className="mt-1 text-secondary text-muted">
              {query ? `No chats match "${query}".` : showReq ? "New message requests show up here." : "Connect with friends, buyers and sellers across your campus."}
            </p>
          </div>
        )}

        {list.map((c) => (
          <Row key={c.id} c={c} active={c.id === activeId} ring={ringFor(c.other_user?.id)} myId={user?.id} />
        ))}
        <div className="h-4" />
      </div>

      {viewer && (
        <StoryViewer
          groups={viewer.groups}
          start={viewer.start}
          myId={user?.id}
          onClose={(ids) => {
            markStoriesSeen(ids);
            setViewer(null);
          }}
        />
      )}
    </div>
  );
}
