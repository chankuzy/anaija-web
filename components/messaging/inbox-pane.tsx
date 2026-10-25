"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { mediaUrl } from "@/lib/api/feed";
import {
  convAvatar,
  convName,
  isInquiry,
  isPending,
  previewOf,
  type Conversation,
} from "@/lib/api/messaging";
import type { StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { useMessages } from "./messages-context";
import { RingAvatar } from "./ring-avatar";
import { StoriesTray } from "./stories-tray";
import { StoryViewer } from "./story-viewer";

type Filter = "all" | "unread" | "requests" | "marketplace" | "groups";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "requests", label: "Requests" },
  { id: "marketplace", label: "Marketplace" },
  { id: "groups", label: "Groups" },
];

function Row({ c, active, ring }: { c: Conversation; active: boolean; ring: boolean }) {
  const unread = c.unread_count > 0;
  return (
    <Link
      href={`/messages/${c.id}`}
      className={`flex items-center gap-3 px-4 py-2 transition-colors ${active ? "bg-white/8" : "hover:bg-white/5"}`}
    >
      <RingAvatar url={convAvatar(c)} name={convName(c)} size={50} ring={ring} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`min-w-0 flex-1 truncate text-[15px] ${unread ? "font-bold text-white" : "font-semibold text-fg"}`}>
            {convName(c)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-secondary ${unread ? "font-medium text-white/90" : "text-muted"}`}>
            {previewOf(c) || "No messages yet"}
          </span>
          {isPending(c) && <span className="shrink-0 text-supporting font-bold text-brand">Request</span>}
          {unread && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
        </span>
      </span>
    </Link>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2" aria-hidden="true">
      <span className="size-[60px] shrink-0 animate-pulse rounded-full bg-card" />
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
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);

  const all = conversations ?? [];
  const counts = useMemo(
    () => ({
      unread: all.filter((c) => c.unread_count > 0).length,
      requests: all.filter(isPending).length,
      marketplace: all.filter(isInquiry).length,
    }),
    [all],
  );

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
    switch (filter) {
      case "unread":
        return all.filter((c) => c.unread_count > 0);
      case "requests":
        return all.filter(isPending);
      case "marketplace":
        return all.filter(isInquiry);
      case "groups":
        return all.filter((c) => c.type === "group");
      default:
        // Requests live behind their own banner/pill so the main list stays clean.
        return counts.requests > 0 ? all.filter((c) => !isPending(c)) : all;
    }
  }, [all, filter, query, counts.requests]);

  const me = user ? { id: user.id, name: user.name, avatar: mediaUrl(user.avatar) } : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pb-3 pt-5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-fg">Messages</h1>
        <label className="mt-3 flex h-11 items-center gap-2.5 rounded-full bg-surface-subtle px-4 text-muted transition-colors focus-within:bg-surface-interactive">
          <Icon name="search" className="size-[18px] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-muted"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-6 place-items-center rounded-full hover:bg-white/10">
              <Icon name="close" className="size-4" />
            </button>
          )}
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!query && <StoriesTray groups={groups} me={me} onOpen={(g, i) => setViewer({ groups: g, start: i })} />}

        {conversations && all.length > 0 && !query && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {FILTERS.map((f) => {
              const n = f.id === "unread" ? counts.unread : f.id === "requests" ? counts.requests : f.id === "marketplace" ? counts.marketplace : 0;
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-secondary transition-colors ${
                    on ? "bg-brand font-extrabold text-brand-fg" : "bg-surface-interactive font-bold text-white/70 hover:bg-surface-elevated"
                  }`}
                >
                  {f.label}
                  {n > 0 && <span className={`text-supporting font-extrabold ${on ? "" : "text-brand"}`}>{n}</span>}
                </button>
              );
            })}
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

        {conversations && filter === "all" && !query && counts.requests > 0 && (
          <button
            type="button"
            onClick={() => setFilter("requests")}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
          >
            <span className="grid size-10 place-items-center rounded-full bg-brand/15 text-brand">
              <Icon name="user" filled className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-fg">Message requests</span>
              <span className="block text-secondary font-bold text-brand">
                {counts.requests === 1 ? "1 new request" : `${counts.requests} new requests`}
              </span>
            </span>
            <Icon name="chevronRight" className="size-4 text-muted" />
          </button>
        )}

        {conversations && list.length === 0 && (
          <div className="px-8 py-16 text-center">
            <p className="text-[15px] font-bold text-fg">
              {query ? "Nothing found" : all.length === 0 ? "No messages yet" : "Nothing here"}
            </p>
            <p className="mt-1 text-secondary text-muted">
              {query
                ? `No conversations match "${query}".`
                : all.length === 0
                  ? "Connect with friends, buyers and sellers across your campus."
                  : "Conversations in this view will show up here."}
            </p>
          </div>
        )}

        {list.map((c) => (
          <Row key={c.id} c={c} active={c.id === activeId} ring={ringFor(c.other_user?.id)} />
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
