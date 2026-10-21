"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { asUtc, convAvatar, convName, messagingApi, type Conversation } from "@/lib/api/messaging";
import { ApiError } from "@/lib/api/client";
import { searchApi, type SearchUser } from "@/lib/api/search";
import { timeAgo } from "@/lib/format";
import { useInbox } from "@/lib/messaging/inbox-context";

type F = "all" | "unread" | "requests" | "marketplace" | "groups";
const FILTERS: { id: F; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "requests", label: "Requests" },
  { id: "marketplace", label: "Marketplace" },
  { id: "groups", label: "Groups" },
];

const isRequest = (c: Conversation) => c.request_status === "pending";

export function previewText(raw: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "No messages yet";
  switch (s) {
    case "[image]": return "Photo";
    case "[video]": return "Video";
    case "[audio]": return "Voice message";
    case "[listing_share]": return "Shared a listing";
    case "[post_share]": return "Shared a post";
    default: return s;
  }
}

function NewChat({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inbox = useInbox();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ q: string; users: SearchUser[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = q.trim();

  useEffect(() => {
    if (t.length < 2) return;
    const ac = new AbortController();
    const id = window.setTimeout(() => {
      searchApi
        .all(t, ac.signal)
        .then((r) => setRes({ q: t, users: r.users }))
        .catch(() => {});
    }, 300);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recents = useMemo(() => {
    const seen = new Set<number>();
    const out: SearchUser[] = [];
    for (const c of inbox.items) {
      const u = c.other_user;
      if (u && !seen.has(u.id)) {
        seen.add(u.id);
        out.push({ id: u.id, name: u.name, username: u.username, avatar: u.avatar, is_verified: false, campus_verified: false });
      }
      if (out.length >= 12) break;
    }
    return out;
  }, [inbox.items]);

  const list = t.length >= 2 && res?.q === t ? res.users : t.length >= 2 ? [] : recents;

  async function start(u: SearchUser) {
    if (busy !== null) return;
    setBusy(u.id);
    setError(null);
    try {
      const r = await messagingApi.open(u.id);
      inbox.prepend({
        id: r.conversation_id,
        type: "direct",
        title: u.name,
        avatar: u.avatar,
        last_message_body: null,
        last_message_at: null,
        unread_count: 0,
        is_muted: false,
        request_status: "accepted",
        other_user: { id: u.id, name: u.name, username: u.username, avatar: u.avatar },
      });
      inbox.reload();
      onClose();
      router.push(`/messages/${r.conversation_id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't open the conversation");
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="New message">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div className="glass relative flex h-[70dvh] w-full max-w-md flex-col overflow-hidden rounded-t-sheet md:rounded-sheet">
        <div className="flex items-center justify-center border-b border-line/70 px-4 py-3.5">
          <span className="text-micro font-bold tracking-[0.18em] text-fg">NEW MESSAGE</span>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 grid size-9 place-items-center text-white/60 hit-area">
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-white/10 bg-card px-3.5">
            <Icon name="search" className="size-[18px] text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or @username"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted"
            />
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
        <p className="px-5 pb-2 pt-4 text-micro font-bold tracking-[0.16em] text-muted">{t.length >= 2 ? "RESULTS" : "RECENT"}</p>
        <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              {t.length >= 2 ? `No one found for "${t}"` : "Search for someone to start messaging."}
            </p>
          ) : (
            list.map((u) => (
              <button key={u.id} type="button" disabled={busy !== null} onClick={() => void start(u)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/6 disabled:opacity-60">
                <Avatar url={u.avatar} name={u.name ?? u.username} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-fg">{u.name ?? u.username}</span>
                  <span className="block truncate text-xs text-muted">@{u.username}</span>
                </span>
                {busy === u.id && <span className="text-xs text-muted">Opening…</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function InboxPanel() {
  const pathname = usePathname();
  const inbox = useInbox();
  const [filter, setFilter] = useState<F>("all");
  const [q, setQ] = useState("");
  const [composing, setComposing] = useState(false);

  const items = inbox.items;
  const counts = useMemo(
    () => ({
      unread: items.filter((c) => c.unread_count > 0).length,
      requests: items.filter(isRequest).length,
      marketplace: items.filter((c) => c.type === "listing_inquiry").length,
    }),
    [items],
  );

  const query = q.trim().toLowerCase();
  const shown = useMemo(() => {
    let l = items;
    if (filter === "all") l = counts.requests > 0 && !query ? items.filter((c) => !isRequest(c)) : items;
    else if (filter === "unread") l = items.filter((c) => c.unread_count > 0);
    else if (filter === "requests") l = items.filter(isRequest);
    else if (filter === "marketplace") l = items.filter((c) => c.type === "listing_inquiry");
    else l = items.filter((c) => c.type === "group");
    if (!query) return l;
    return l.filter(
      (c) =>
        convName(c).toLowerCase().includes(query) ||
        (c.other_user?.username ?? "").toLowerCase().includes(query) ||
        (c.last_message_body ?? "").toLowerCase().includes(query),
    );
  }, [items, filter, query, counts.requests]);

  let body: React.ReactNode;
  if (inbox.loading) body = <p className="py-24 text-center text-sm text-muted">Loading…</p>;
  else if (inbox.error && items.length === 0) {
    body = (
      <div className="py-24 text-center">
        <p className="text-sm text-muted">{inbox.error}</p>
        <button type="button" onClick={inbox.reload} className="mt-4 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black">Try again</button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="px-8 py-24 text-center">
        <p className="text-[17px] font-bold text-fg">No messages yet</p>
        <p className="mt-1.5 text-secondary text-muted">Connect with friends, buyers and sellers across your campus.</p>
        <button type="button" onClick={() => setComposing(true)} className="mt-5 h-11 rounded-full bg-white px-6 text-secondary font-bold text-black">Start a chat</button>
      </div>
    );
  } else if (shown.length === 0) {
    body = <p className="px-8 py-24 text-center text-sm text-muted">{query ? `Nothing matches "${q.trim()}".` : "Nothing here."}</p>;
  } else {
    body = (
      <>
        {filter === "all" && counts.requests > 0 && !query && (
          <button type="button" onClick={() => setFilter("requests")} className="flex w-full items-center gap-3.5 border-b border-white/6 px-5 py-3.5 text-left hover:bg-card/50">
            <span className="grid size-10 place-items-center rounded-full bg-warm/14 text-warm"><Icon name="userPlus" filled className="size-[19px]" /></span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-fg">Message requests</span>
              <span className="block text-secondary font-semibold text-warm">{counts.requests === 1 ? "1 new request" : `${counts.requests} new requests`}</span>
            </span>
            <Icon name="chevronRight" className="size-4 text-muted" />
          </button>
        )}
        {shown.map((c) => {
          const unread = c.unread_count > 0;
          const active = pathname === `/messages/${c.id}`;
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className={`flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-card/60 ${active ? "bg-card" : ""}`}>
              <Avatar url={convAvatar(c)} name={convName(c)} size={54} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate text-label tracking-tight text-fg ${unread ? "font-bold" : "font-semibold"}`}>{convName(c)}</span>
                  {c.last_message_at && <span className="shrink-0 text-supporting text-muted">{timeAgo(asUtc(c.last_message_at))}</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate text-body ${unread ? "font-medium text-fg/90" : "text-fg/55"}`}>
                    {isRequest(c) ? "Message request" : previewText(c.last_message_body)}
                  </span>
                  {c.is_muted && <span className="text-micro font-semibold text-muted">Muted</span>}
                  {unread && (
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warm px-1 text-micro font-bold text-black">
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <>
      <header className="px-5 pb-2 pt-4" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-[30px] font-medium leading-none tracking-[-0.03em] text-fg">Messages</h1>
          <button type="button" aria-label="New message" onClick={() => setComposing(true)} className="grid size-11 place-items-center rounded-full border border-white/14 bg-white/8 text-fg">
            <Icon name="edit" className="size-5" />
          </button>
        </div>
        <div className="mt-4 flex h-11 items-center gap-2.5 rounded-image border border-white/12 bg-white/6 px-3.5">
          <Icon name="search" className="size-[18px] text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
        </div>
        {items.length > 0 && (
          <div className="no-scrollbar -mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5">
            {FILTERS.map((f) => {
              const n = f.id === "unread" ? counts.unread : f.id === "requests" ? counts.requests : f.id === "marketplace" ? counts.marketplace : 0;
              return (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-[18px] text-[15px] ${f.id === filter ? "border-white/38 bg-white/14 font-bold text-fg" : "border-white/14 font-medium text-fg/70"}`}>
                  {f.label}
                  {n > 0 && <span className="text-secondary font-bold text-warm">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">{body}</div>
      {composing && <NewChat onClose={() => setComposing(false)} />}
    </>
  );
}
