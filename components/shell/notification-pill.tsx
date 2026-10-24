"use client";
import { ChatSkeleton } from "@/components/ui/skeleton";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { useActivity } from "@/lib/activity/activity-context";
import { resolveTarget } from "@/lib/activity/route";
import { activityApi, type ActivityDest, type ActivityItem } from "@/lib/api/activity";
import { convAvatar, convName, isPending, messagingApi, previewOf, type Conversation, type Message } from "@/lib/api/messaging";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow } from "@/lib/feed/follow-store";
import { timeAgo } from "@/lib/format";
import { useInterval } from "@/lib/messaging/use-interval";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { useMessagesUnread } from "@/lib/messaging/unread-context";
import { emitBanner } from "@/lib/notifications/banner-bus";

type Tab = "chats" | "activity";
type Peek = { key: string; avatar: string | null; name: string; text: string; conv?: number; act?: ActivityItem };
type Out = { key: string; body: string; failed: boolean };

const KIND: Record<string, { icon: IconName; color: string }> = {
  like: { icon: "heart", color: "#E11D48" },
  story_like: { icon: "heart", color: "#E11D48" },
  comment: { icon: "message", color: "#2563EB" },
  reply: { icon: "message", color: "#2563EB" },
  story_reply: { icon: "message", color: "#2563EB" },
  follow: { icon: "userPlus", color: "#7C3AED" },
  follow_back: { icon: "userPlus", color: "#7C3AED" },
  repost: { icon: "repeat", color: "#16A34A" },
  post_new: { icon: "plus", color: "#7C3AED" },
  inquiry: { icon: "bag", color: "#C026D3" },
};
const FALLBACK = { icon: "bell" as IconName, color: "#71717A" };

// Server timestamps can come back without a zone; they are UTC.
const utc = (s: string | null) => (!s ? "" : /(Z|[+-]\d\d(:?\d\d)?)$/i.test(s) ? s : `${s.replace(" ", "T")}Z`);

function Count({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={`grid h-[20px] min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

function ActRow({ it, onOpen, onThumb, onFollow }: { it: ActivityItem; onOpen: () => void; onThumb: () => void; onFollow: () => void }) {
  const a = it.actors[0];
  const k = KIND[it.kind] ?? FALLBACK;
  const unread = !it.is_read;
  const preview = it.preview ? (it.quote ? `\u201C${it.preview}\u201D` : it.preview) : null;
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5">
      <button type="button" aria-label="Open" onClick={onOpen} className="absolute inset-0" />
      <span className="pointer-events-none relative shrink-0">
        <Avatar url={a?.avatar} name={a?.name} size={46} />
        <span className={`absolute -bottom-1 -right-1 grid size-[20px] place-items-center rounded-full bg-surface-elevated ring-2 ring-surface-subtle ${it.kind === "like" || it.kind === "story_like" ? "text-like" : "text-brand"}`}>
          <Icon name={k.icon} filled className="size-[11px]" />
        </span>
      </span>
      <div className="pointer-events-none min-w-0 flex-1">
        <p className={`line-clamp-2 text-[14px] leading-[1.3] ${unread ? "font-medium text-fg" : "text-fg/80"}`}>{it.title}</p>
        {preview && <p className="mt-0.5 line-clamp-1 text-supporting text-muted">{preview}</p>}
        {it.follow_back !== null && a && (
          <button
            type="button"
            onClick={onFollow}
            className={`pointer-events-auto relative mt-1.5 h-7 rounded-full px-3 text-micro font-bold ${it.follow_back ? "bg-surface-interactive text-fg" : "bg-brand text-brand-fg"}`}
          >
            {it.follow_back ? "Following" : "Follow back"}
          </button>
        )}
        <p className="mt-0.5 flex items-center gap-1.5 text-supporting text-muted">
          {timeAgo(utc(it.last_event_at))}
          {unread && <span className="size-[6px] rounded-full bg-brand" />}
        </p>
      </div>
      {it.thumb && (
        <button type="button" onClick={onThumb} aria-label="Open content" className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.thumb} alt="" loading="lazy" className="size-[46px] rounded-xl object-cover" />
        </button>
      )}
    </div>
  );
}

// Docked chat window (Instagram-style): back to the list, expand to the full inbox page, close.
function MiniChat({
  conv,
  me,
  onBack,
  onExpand,
  onClose,
  onChanged,
}: {
  conv: Conversation;
  me: number | null;
  onBack: () => void;
  onExpand: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const id = conv.id;
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [outbox, setOutbox] = useState<Out[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastRead = useRef(0);

  const load = useCallback(
    () =>
      messagingApi
        .messages(id)
        .then((r) => {
          setMsgs(r.items);
          setLoading(false);
        })
        .catch(() => setLoading(false)),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useInterval(() => void load(), 4000, true);

  const last = msgs.length ? msgs[msgs.length - 1] : null;
  const lastId = last?.id ?? 0;
  const lastFromOther = !!last && last.sender_id !== me;
  useEffect(() => {
    if (lastId > 0 && lastFromOther && lastId !== lastRead.current) {
      lastRead.current = lastId;
      void messagingApi.markRead(id, lastId).then(() => onChanged());
    }
  }, [id, lastId, lastFromOther, onChanged]);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length, outbox.length, loading]);

  async function send(body: string, retryKey?: string) {
    const key = retryKey ?? `o${Date.now()}`;
    stick.current = true;
    setOutbox((p) => (retryKey ? p.map((o) => (o.key === key ? { ...o, failed: false } : o)) : [...p, { key, body, failed: false }]));
    try {
      await messagingApi.send(id, body);
      await load();
      setOutbox((p) => p.filter((o) => o.key !== key));
      onChanged();
    } catch {
      setOutbox((p) => p.map((o) => (o.key === key ? { ...o, failed: true } : o)));
    }
  }
  function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    void send(t);
  }

  let prevAt = 0;
  const rows = msgs.map((m) => {
    const at = Date.parse(utc(m.created_at)) || 0;
    const sep = at - prevAt > 3_600_000 ? new Date(at).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" }) : null;
    prevAt = at;
    return { m, sep };
  });

  return (
    <div className="flex h-[min(540px,calc(100dvh-140px))] flex-col">
      <header className="flex items-center gap-2 px-2 py-2.5">
        <button type="button" aria-label="Back" onClick={onBack} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/8">
          <Icon name="back" className="size-5" />
        </button>
        <Avatar url={convAvatar(conv)} name={convName(conv)} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-fg">{convName(conv)}</p>
          {conv.other_user?.username && <p className="truncate text-supporting leading-tight text-muted">@{conv.other_user.username}</p>}
        </div>
        <button type="button" aria-label="Open full chat" title="Open full chat" onClick={onExpand} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/8">
          <ExpandIcon />
        </button>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/8">
          <Icon name="close" className="size-5" />
        </button>
      </header>

      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {loading && <ChatSkeleton />}
        {!loading && msgs.length === 0 && outbox.length === 0 && <p className="m-auto text-secondary text-muted">No messages yet. Say hi.</p>}
        {rows.map(({ m, sep }) => {
          const mine = m.sender_id === me;
          const img = m.media_url && (m.media_type ?? "").startsWith("image");
          return (
            <div key={m.id} className="flex flex-col">
              {sep && <p className="my-2 text-center text-micro text-muted">{sep}</p>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] overflow-hidden rounded-[20px] text-[14px] leading-[1.35] ${
                    mine ? "bubble-sent" : "bg-surface-interactive text-fg"
                  } ${img || m.shared_post ? "p-1" : "px-3.5 py-2"}`}
                >
                  {m.is_deleted ? (
                    <span className="italic opacity-60">Message removed</span>
                  ) : (
                    <>
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.media_url!} alt="" loading="lazy" className="max-h-56 rounded-2xl object-cover" />
                      )}
                      {m.shared_post && (
                        <span className="block overflow-hidden rounded-2xl bg-black/20">
                          {m.shared_post.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.shared_post.image} alt="" loading="lazy" className="max-h-40 w-full object-cover" />
                          )}
                          <span className="block px-2.5 py-1.5 text-supporting">
                            {m.shared_post.unavailable ? "Post unavailable" : m.shared_post.author ? `Post by @${m.shared_post.author}` : "Shared a post"}
                          </span>
                        </span>
                      )}
                      {m.body && !(m.shared_post && /shared a (post|listing)/i.test(m.body)) && (
                        <span className={`whitespace-pre-wrap break-words ${img || m.shared_post ? "block px-2.5 py-1.5" : ""}`}>{m.body}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {outbox.map((o) => (
          <div key={o.key} className="flex justify-end">
            <div className="flex max-w-[78%] flex-col items-end gap-1">
              <div className={`bubble-sent rounded-[20px] px-3.5 py-2 text-[14px] leading-[1.35] ${o.failed ? "opacity-100" : "opacity-60"}`}>{o.body}</div>
              {o.failed && (
                <button type="button" onClick={() => void send(o.body, o.key)} className="text-micro font-semibold text-danger">
                  Not sent. Tap to retry
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
          placeholder="Message…"
          className="h-11 min-w-0 flex-1 rounded-full bg-surface-interactive px-4 text-body text-fg outline-none placeholder:text-muted focus:bg-surface-elevated"
        />
        <button
          type="button"
          aria-label="Send"
          disabled={!text.trim()}
          onClick={submit}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition active:scale-95 disabled:opacity-35"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function NotificationPill() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();
  const { unseen, version, clearUnseen } = useActivity();
  const { refresh: refreshMsgs } = useMessagesUnread();
  const { open: panelOpen, show: showPanel } = useNotificationsPanel();
  const enabled = status === "authed";

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chats");
  const [view, setView] = useState<number | null>(null); // conversation id shown in the mini chat
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [acts, setActs] = useState<ActivityItem[]>([]);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const peekTimer = useRef<number | null>(null);
  const noteTimer = useRef<number | null>(null);
  const knownConv = useRef(new Map<number, string>());
  const knownAct = useRef(new Set<number>());
  const primedConv = useRef(false);
  const primedAct = useRef(false);
  const latestAt = useRef<string | null>(null);
  const wantSeen = useRef(false);

  useEffect(() => {
    openRef.current = open;
  });
  useEffect(
    () => () => {
      if (peekTimer.current !== null) window.clearTimeout(peekTimer.current);
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    },
    [],
  );

  const showPeek = useCallback((p: Peek) => {
    if (openRef.current) return;
    // The in-app banner (components/shell/in-app-banner.tsx) is the transient surface now.
    emitBanner({
      source: "poll",
      key: p.key,
      title: p.act ? p.act.title : p.name,
      body: p.act ? (p.act.preview ? (p.act.quote ? `\u201C${p.act.preview}\u201D` : p.act.preview) : null) : p.text,
      avatar: p.avatar,
      image: p.act?.thumb ?? null,
      kind: p.act ? p.act.kind : "message",
      chat: p.conv !== undefined,
      conv: p.conv,
      act: p.act,
    });
  }, []);

  const loadConvs = useCallback(() => {
    messagingApi
      .inbox()
      .then((list) => {
        setConvs(list);
        const known = knownConv.current;
        if (!primedConv.current) {
          primedConv.current = true;
          for (const c of list) known.set(c.id, c.last_message_at ?? "");
          return;
        }
        let fresh: Conversation | null = null;
        for (const c of list) {
          const at = c.last_message_at ?? "";
          if (!fresh && known.get(c.id) !== at && c.unread_count > 0 && !c.is_muted) fresh = c;
          known.set(c.id, at);
        }
        if (fresh) {
          showPeek({ key: `c${fresh.id}:${fresh.last_message_at}`, avatar: convAvatar(fresh), name: convName(fresh), text: previewOf(fresh), conv: fresh.id });
        }
      })
      .catch(() => {});
  }, [showPeek]);

  const loadActs = useCallback(() => {
    activityApi
      .list("all", null)
      .then((r) => {
        latestAt.current = r.items[0]?.last_event_at ?? null;
        // Chat rows live in the Chats tab; keep Activity to everything else.
        const items = r.items.filter((i) => i.kind !== "message").slice(0, 12);
        setActs(items);
        if (wantSeen.current && latestAt.current) {
          wantSeen.current = false;
          clearUnseen();
          void activityApi.seen(latestAt.current).catch(() => {});
        }
        const known = knownAct.current;
        const fresh = primedAct.current ? items.find((i) => !i.is_read && !known.has(i.id)) : undefined;
        primedAct.current = true;
        for (const i of items) known.add(i.id);
        if (fresh) {
          const a = fresh.actors[0];
          showPeek({ key: `a${fresh.id}:${fresh.last_event_at}`, avatar: a?.avatar ?? null, name: a?.name ?? "Anaija", text: fresh.title, act: fresh });
        }
      })
      .catch(() => {});
  }, [clearUnseen, showPeek]);

  useEffect(() => {
    if (enabled) {
      loadConvs();
      loadActs();
    }
  }, [enabled, loadConvs, loadActs]);
  useInterval(loadConvs, 20_000, enabled);
  useInterval(loadActs, 45_000, enabled);

  const seenVersion = useRef(version);
  useEffect(() => {
    if (version === seenVersion.current) return;
    seenVersion.current = version;
    loadConvs();
    loadActs();
  }, [version, loadConvs, loadActs]);

  // Click outside closes the list, but never a chat you are typing in (only X or the pill closes that).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (view === null && rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, view]);

  const hide =
    !enabled || panelOpen || pathname === "/login" || pathname === "/setup" || pathname === "/messages" || pathname.startsWith("/messages/");
  if (hide) return null;

  const main = convs.filter((c) => !isPending(c));
  const reqs = convs.filter((c) => isPending(c));
  const chatUnread = main.filter((c) => !c.is_muted).reduce((n, c) => n + c.unread_count, 0);
  const reqUnread = reqs.reduce((n, c) => n + Math.max(1, c.unread_count), 0);
  const list = [...main].sort((a, b) => Number(b.unread_count > 0) - Number(a.unread_count > 0)).slice(0, 6);
  const stack = convs.filter((c) => c.unread_count > 0 && !c.is_muted).slice(0, 3);
  const badge = chatUnread + reqUnread + unseen;
  const active = view !== null ? convs.find((c) => c.id === view) : undefined;

  function flash(m: string) {
    setNote(m);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2000);
  }
  function go(url: string) {
    setOpen(false);
    setView(null);
    setPeek(null);
    router.push(url);
  }
  function openFull() {
    setOpen(false);
    setView(null);
    setPeek(null);
    showPanel();
  }
  function openChat(id: number) {
    const c = convs.find((x) => x.id === id);
    // Requests need accept/decline, which lives on the full page.
    if (!c || isPending(c)) return go(`/messages/${id}`);
    setPeek(null);
    setView(id);
    setOpen(true);
  }
  function markSeen() {
    if (latestAt.current) {
      clearUnseen();
      void activityApi.seen(latestAt.current).catch(() => {});
    } else wantSeen.current = true;
  }
  function pickTab(t: Tab) {
    setTab(t);
    if (t === "activity") markSeen();
  }
  function toggle() {
    if (open) return setOpen(false);
    if (view === null) {
      const t: Tab = chatUnread + reqUnread > 0 || unseen === 0 ? "chats" : "activity";
      setTab(t);
      if (t === "activity") markSeen();
    }
    setPeek(null);
    setOpen(true);
    loadConvs();
    loadActs();
  }
  function openAct(it: ActivityItem, d: ActivityDest | null) {
    if (it.id > 0 && !it.is_read) {
      setActs((p) => p.map((x) => (x.id === it.id ? { ...x, is_read: true } : x)));
      void activityApi.read(it.id).catch(() => {});
    }
    const t = resolveTarget(it, d ?? it.destination, user?.username);
    switch (t.type) {
      case "conversation":
        return openChat(t.id);
      case "url":
        return go(t.url);
      case "toast":
        return flash(t.message);
      case "none":
        return;
      default:
        // Grouped likes and stories need the full viewer, which lives in the Activity panel.
        return openFull();
    }
  }
  async function followBack(it: ActivityItem) {
    const a = it.actors[0];
    if (!a || it.follow_back === null) return;
    const r = await toggleFollow(a.id, it.follow_back);
    if (r === null) flash("Couldn't update follow");
    else setActs((p) => p.map((x) => (x.id === it.id ? { ...x, follow_back: r } : x)));
  }

  const stop = { onWheel: (e: React.WheelEvent) => e.stopPropagation(), onTouchMove: (e: React.TouchEvent) => e.stopPropagation() };

  return (
    <div ref={rootRef} className="fixed bottom-6 right-6 z-30 hidden flex-col items-end gap-3 md:flex" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      {open && (
        <section
          aria-label="Messages and activity"
          className="pill-card w-[392px] max-w-[calc(100vw-48px)] overflow-hidden rounded-[28px] bg-surface-subtle shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
        >
          {active ? (
            <MiniChat
              key={active.id}
              conv={active}
              me={user?.id ?? null}
              onBack={() => setView(null)}
              onExpand={() => go(`/messages/${active.id}`)}
              onClose={() => {
                setOpen(false);
                setView(null);
              }}
              onChanged={() => {
                loadConvs();
                refreshMsgs();
              }}
            />
          ) : (
            <>
              <div className="p-3 pb-2">
                <div className="flex gap-1 rounded-full bg-surface-interactive p-1">
                  {(["chats", "activity"] as Tab[]).map((t) => {
                    const n = t === "chats" ? chatUnread + reqUnread : unseen;
                    const on = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => pickTab(t)}
                        className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-full text-secondary font-semibold transition-colors ${
                          on ? "bg-brand font-extrabold text-brand-fg" : "text-white/60 hover:text-white"
                        }`}
                      >
                        {t === "chats" ? "Chats" : "Activity"}
                        {!on && <Count n={n} className="bg-brand text-brand-fg" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div {...stop} className="no-scrollbar max-h-[min(440px,calc(100dvh-230px))] overflow-y-auto overscroll-contain">
                {tab === "chats" && (
                  <>
                    {reqs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => go("/messages")}
                        className="mx-3 mb-1 flex w-[calc(100%-24px)] items-center gap-3 rounded-2xl bg-white/6 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                      >
                        <span className="grid size-9 place-items-center rounded-full bg-brand/15 text-brand">
                          <Icon name="userPlus" className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-body font-semibold text-fg">Message requests</span>
                          <span className="block text-supporting text-muted">
                            {reqs.length} {reqs.length === 1 ? "person wants" : "people want"} to chat
                          </span>
                        </span>
                        <Count n={reqUnread} className="bg-brand text-brand-fg" />
                      </button>
                    )}
                    {list.length === 0 && reqs.length === 0 && (
                      <div className="px-6 py-12 text-center">
                        <p className="text-[15px] font-bold text-fg">No conversations yet</p>
                        <button type="button" onClick={() => go("/discover")} className="mt-3 h-9 rounded-full bg-brand px-4 text-secondary font-extrabold text-brand-fg">
                          Find people
                        </button>
                      </div>
                    )}
                    {list.map((c) => {
                      const unread = c.unread_count > 0 && !c.is_muted;
                      return (
                        <div key={c.id} className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5">
                          <button type="button" aria-label={`Open ${convName(c)}`} onClick={() => openChat(c.id)} className="absolute inset-0" />
                          <span className="pointer-events-none shrink-0">
                            <Avatar url={convAvatar(c)} name={convName(c)} size={48} />
                          </span>
                          <span className="pointer-events-none min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className={`truncate text-[15px] ${unread ? "font-bold text-fg" : "font-semibold text-fg/90"}`}>{convName(c)}</span>
                              <span className="shrink-0 text-supporting text-muted">{timeAgo(utc(c.last_message_at))}</span>
                            </span>
                            <span className={`block truncate text-secondary ${unread ? "font-medium text-fg" : "text-muted"}`}>{previewOf(c) || "Say hi"}</span>
                          </span>
                          {unread && <Count n={c.unread_count} className="pointer-events-none relative bg-brand text-brand-fg" />}
                        </div>
                      );
                    })}
                  </>
                )}

                {tab === "activity" &&
                  (acts.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-[15px] font-bold text-fg">No activity yet</p>
                      <p className="mt-1 text-secondary text-muted">Likes, comments and follows land here</p>
                    </div>
                  ) : (
                    acts.map((it) => (
                      <ActRow
                        key={it.id}
                        it={it}
                        onOpen={() => openAct(it, it.destination)}
                        onThumb={() => openAct(it, it.content ?? it.destination)}
                        onFollow={() => void followBack(it)}
                      />
                    ))
                  ))}
              </div>

              {note && <p className="px-4 pb-1 text-supporting font-bold text-brand">{note}</p>}
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => (tab === "chats" ? go("/messages") : openFull())}
                  className="h-10 w-full rounded-full text-secondary font-semibold text-white/70 transition-colors hover:bg-white/8 hover:text-white"
                >
                  {tab === "chats" ? "Open inbox" : "See all activity"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {!open && peek && (
        <button
          key={peek.key}
          type="button"
          onClick={() => {
            const p = peek;
            setPeek(null);
            if (p.conv) openChat(p.conv);
            else if (p.act) openAct(p.act, p.act.destination);
          }}
          className="pill-card flex w-[320px] max-w-[calc(100vw-48px)] items-center gap-3 rounded-[24px] bg-surface-subtle p-3 text-left shadow-[0_16px_48px_rgba(0,0,0,0.55)] transition-colors hover:bg-surface-interactive"
        >
          <Avatar url={peek.avatar} name={peek.name} size={42} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold text-fg">{peek.name}</span>
            <span className="line-clamp-2 text-secondary leading-[1.3] text-white/65">{peek.text}</span>
          </span>
          <span className="size-2 shrink-0 rounded-full bg-brand" />
        </button>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative flex h-14 items-center gap-3 rounded-full bg-surface-interactive pl-2 pr-5 text-fg shadow-[0_12px_40px_rgba(0,0,0,0.55)] transition hover:bg-surface-elevated active:scale-[0.97] ${
          badge > 0 && !open ? "pill-glow" : ""
        }`}
      >
        {open ? (
          <span className="grid size-10 place-items-center rounded-full bg-white/10">
            <Icon name="close" className="size-5" />
          </span>
        ) : stack.length > 0 ? (
          <span className="flex pl-1">
            {stack.map((c, i) => (
              <span key={c.id} className="rounded-full ring-2 ring-surface-interactive" style={{ marginLeft: i ? -12 : 0 }}>
                <Avatar url={convAvatar(c)} name={convName(c)} size={36} />
              </span>
            ))}
          </span>
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-brand text-brand-fg">
            <Icon name="message" filled className="size-5" />
          </span>
        )}
        <span className="text-[15px] font-semibold tracking-tight">Messages</span>
        {!open && badge > 0 && <Count n={badge} className="bg-danger text-white" />}
      </button>
    </div>
  );
}
