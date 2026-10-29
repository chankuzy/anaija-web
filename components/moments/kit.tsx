"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AREA, Chip, Sheet, messageOf, shareLink, useFetch } from "@/components/community/kit";
import { useToast } from "@/components/settings/settings-kit";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { communitiesApi } from "@/lib/api/communities";
import { momentsApi, newKey, type Entry, type EntryPage, type Moment, type MomentCardData, type MomentStatus, type MomentType } from "@/lib/api/moments";
import { useAuth } from "@/lib/auth/auth-context";
import { timeAgo } from "@/lib/format";
import { useInterval } from "@/lib/messaging/use-interval";
import { TYPE_META, fmtLeft, fmtWhen, momentUrl, shareLine, statusLabel, tint, useNow } from "@/lib/moments/meta";
import { subscribeBroadcast } from "@/lib/realtime/client";

export interface ViewProps {
  m: Moment; code: string; version: number; reload: () => void;
  patch: (fn: (m: Moment) => Moment) => void; show: (s: string) => void;
}

export function TypeIcon({ type, size = 44 }: { type: MomentType; size?: number }) {
  const t = TYPE_META[type];
  return (
    <span className="grid shrink-0 place-items-center rounded-[14px]" style={{ width: size, height: size, background: tint(t.color, 16), color: t.color }}>
      <Icon name={t.icon} filled className={size >= 44 ? "size-6" : "size-5"} />
    </span>
  );
}

export function StatusPill({ type, status }: { type: MomentType; status: MomentStatus }) {
  const live = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-micro font-extrabold uppercase tracking-wide ${live ? "bg-brand text-brand-fg" : "bg-surface-interactive text-muted"}`}>
      {live && <span className="mo-dot size-1.5 rounded-full bg-brand-fg" />}
      {statusLabel(type, status)}
    </span>
  );
}

export function Countdown({ to, label, big = false, onDone }: { to: string; label?: string; big?: boolean; onDone?: () => void }) {
  const now = useNow();
  const left = Date.parse(to) - now;
  const fired = useRef(false);
  useEffect(() => {
    if (now > 0 && left <= 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [now, left, onDone]);
  return (
    <div className={big ? "text-center" : ""}>
      {label && <p className="text-micro font-bold uppercase tracking-[0.1em] text-muted">{label}</p>}
      <p className={`font-extrabold tabular-nums tracking-tight text-fg ${big ? "mt-1 text-[48px] leading-none" : "text-[20px]"}`}>{now === 0 ? "…" : fmtLeft(left)}</p>
    </div>
  );
}

export function ConnectionBar({ joined, online }: { joined: boolean; online: boolean }) {
  if (online && joined) return null;
  return (
    <div role="status" className="mb-3 rounded-2xl bg-surface-interactive px-4 py-2.5 text-secondary font-semibold text-fg">
      {!online ? "You're offline. Showing what we last saw." : "Reconnecting to live updates…"}
    </div>
  );
}

// One broadcast subscription per Moment. It only says "something changed"; the client refetches.
export function useMomentLive(key: string | null, onChange: () => void) {
  const [version, setVersion] = useState(0);
  const [joined, setJoined] = useState(true);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    if (!key) return;
    let t: number | undefined;
    let was = false;
    const off = subscribeBroadcast(
      `moment:${key}`,
      {
        changed: () => {
          window.clearTimeout(t);
          t = window.setTimeout(() => { cb.current(); setVersion((v) => v + 1); }, 350);
        },
      },
      (j) => {
        setJoined(j);
        if (j && was) { cb.current(); setVersion((v) => v + 1); }
        if (j) was = true;
      },
    );
    return () => { window.clearTimeout(t); off(); };
  }, [key]);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  useInterval(() => { cb.current(); setVersion((v) => v + 1); }, 45_000, !!key);
  return { version, joined, online };
}

type Page = { key: string | null; items: Entry[]; cursor: string | null };
export function useEntryList(code: string, query: { filter?: string; sort?: string }, enabled: boolean, version: number, mode: "entries" | "war" = "entries") {
  const { status } = useAuth();
  const { filter, sort } = query;
  const key = enabled && status !== "loading" ? `me:${code}:${mode}|${filter ?? ""}|${sort ?? ""}:${status}` : null;
  const load = useCallback(
    (cursor: string | null): Promise<EntryPage> => (mode === "war" ? momentsApi.warEntries(code, cursor) : momentsApi.entries(code, { filter, sort, cursor })),
    [code, mode, filter, sort],
  );
  const q = useFetch<EntryPage>(key, () => load(null), { persist: false });
  const { reload, patch } = q;
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    reload();
  }, [version, reload]);

  const [extra, setExtra] = useState<Page | null>(null);
  const [local, setLocal] = useState<Page | null>(null);
  const [gone, setGone] = useState<number[]>([]);
  const more = extra && extra.key === key ? extra : null;
  const mine = local && local.key === key ? local : null;
  const byId = new Map<number, Entry>();
  for (const e of [...(mine?.items ?? []), ...(q.data?.entries ?? []), ...(more?.items ?? [])]) if (!byId.has(e.id)) byId.set(e.id, e);
  const items = [...byId.values()].filter((e) => !gone.includes(e.id));
  const cursor = more ? more.cursor : (q.data?.next_cursor ?? null);

  const loadMore = useCallback(async () => {
    if (!key || !cursor) return;
    try {
      const r = await load(cursor);
      setExtra((x) => ({ key, items: [...(x && x.key === key ? x.items : []), ...r.entries], cursor: r.next_cursor }));
    } catch { /* the button stays; try again */ }
  }, [key, cursor, load]);
  const add = useCallback((e: Entry) => setLocal((l) => ({ key, items: [e, ...(l && l.key === key ? l.items : [])], cursor: null })), [key]);
  const drop = useCallback((id: number) => setGone((g) => [...g, id]), []);
  const patchOne = useCallback((id: number, p: Partial<Entry>) => {
    const f = (e: Entry) => (e.id === id ? { ...e, ...p } : e);
    patch((d) => ({ ...d, entries: d.entries.map(f) }));
    setExtra((x) => (x ? { ...x, items: x.items.map(f) } : x));
    setLocal((l) => (l ? { ...l, items: l.items.map(f) } : l));
  }, [patch]);
  return { items, loading: q.loading, error: q.error, locked: q.data?.locked ?? false, cursor, loadMore, reload, add, drop, patchOne };
}

// Optimistic react / upvote with rollback; the server stays the judge.
export function useReact(code: string, patchOne: (id: number, p: Partial<Entry>) => void, show: (s: string) => void, canReact: boolean, authed: boolean) {
  return useCallback(async (e: Entry, field: "upvotes_count" | "reactions_count") => {
    if (!canReact) return show(authed ? "Join the community to react" : "Sign in to react");
    const was = e.my_reaction !== null;
    patchOne(e.id, { my_reaction: was ? null : "like", [field]: Math.max(0, e[field] + (was ? -1 : 1)) } as Partial<Entry>);
    try {
      const r = await momentsApi.react(code, e.id, "like");
      patchOne(e.id, { my_reaction: r.my_reaction, [field]: r.count } as Partial<Entry>);
    } catch (err) {
      patchOne(e.id, { my_reaction: e.my_reaction, [field]: e[field] } as Partial<Entry>);
      show(messageOf(err));
    }
  }, [code, patchOne, show, canReact, authed]);
}

export function AliasDot({ alias, size = 32 }: { alias: string; size?: number }) {
  const n = parseInt(alias.replace(/\D/g, ""), 10) || 0;
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-extrabold text-black" style={{ width: size, height: size, fontSize: size * 0.34, background: `hsl(${(n * 47) % 360} 70% 72%)` }}>
      {String(n).slice(-2)}
    </span>
  );
}
export function Byline({ e, size = 32 }: { e: Entry; size?: number }) {
  return e.author.anonymous ? (
    <span className="flex min-w-0 items-center gap-2.5"><AliasDot alias={e.author.alias} size={size} /><span className="truncate text-[14px] font-bold text-fg">{e.author.alias}</span></span>
  ) : (
    <span className="flex min-w-0 items-center gap-2.5"><Avatar url={e.author.avatar} name={e.author.name} size={size} /><span className="truncate text-[14px] font-bold text-fg">{e.author.name ?? e.author.username}</span></span>
  );
}

export function Composer({ placeholder, cta, max = 800, allowAnon, forceAnon = false, defaultAnon = true, busy, onSend, autoFocus = false, hint }: {
  placeholder: string; cta: string; max?: number; allowAnon: boolean; forceAnon?: boolean; defaultAnon?: boolean; busy: boolean;
  onSend: (body: string, anonymous: boolean) => Promise<boolean>; autoFocus?: boolean; hint?: string;
}) {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(defaultAnon);
  const isAnon = forceAnon || (allowAnon && anon);
  async function go() {
    const t = text.trim();
    if (!t || busy) return;
    if (await onSend(t, isAnon)) setText("");
  }
  return (
    <div>
      <textarea className={`${AREA} min-h-[88px]`} autoFocus={autoFocus} maxLength={max} placeholder={placeholder} value={text} disabled={busy}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go(); }} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {allowAnon && !forceAnon && (
          <>
            <Chip active={anon} onClick={() => setAnon(true)}>Anonymous</Chip>
            <Chip active={!anon} onClick={() => setAnon(false)}>As me</Chip>
          </>
        )}
        <span className="flex-1 px-1 text-supporting text-muted">{text.length}/{max}</span>
        <button type="button" disabled={!text.trim() || busy} onClick={() => void go()} className={buttonClass("primary", "h-10 px-5")}>{busy ? "Sending…" : cta}</button>
      </div>
      {hint && <p className="mt-2 px-1 text-supporting leading-[1.4] text-muted">{hint}</p>}
    </div>
  );
}

export function EntryCard({ code, e, big = false, animate = null, delay = 0, canReact, canReply = false, allowAnon = false, reactField, reactSlot, onReact, onShare, onReport, onRemove, actions, footer, show }: {
  code: string; e: Entry; big?: boolean; animate?: "in" | "reveal" | null; delay?: number; canReact: boolean; canReply?: boolean; allowAnon?: boolean;
  reactField: "upvotes_count" | "reactions_count"; reactSlot?: ReactNode; onReact?: (e: Entry) => void; onShare?: (e: Entry) => void;
  onReport?: (e: Entry) => void; onRemove?: (e: Entry) => void; actions?: ReactNode; footer?: ReactNode; show: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const replies = useFetch(open ? `mr:${code}:${e.id}` : null, () => momentsApi.replies(code, e.id), { persist: false });
  const count = e[reactField];
  const mine = e.my_reaction !== null;
  async function reply(body: string, anonymous: boolean) {
    setSending(true);
    try {
      await momentsApi.entry(code, { body, parent_id: e.id, anonymous, client_key: newKey() });
      replies.reload();
      return true;
    } catch (err) {
      show(messageOf(err));
      return false;
    } finally {
      setSending(false);
    }
  }
  return (
    <div id={`r${e.id}`} className={`rounded-[22px] bg-surface-subtle p-4 ${animate === "reveal" ? "mo-reveal" : animate === "in" ? "mo-in" : ""}`} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <div className="flex items-center gap-2.5">
        <Byline e={e} />
        {e.is_mine && <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-micro font-bold text-brand">You</span>}
        <span className="ml-auto shrink-0 text-supporting text-muted">{timeAgo(e.reveal_at ?? e.created_at)}</span>
      </div>
      <p className={`selectable mt-3 whitespace-pre-wrap break-words text-fg ${big ? "text-[20px] font-semibold leading-[1.35]" : "text-[15px] leading-[1.5]"}`}>{e.body}</p>
      {e.answer && (
        <div className="mt-3 rounded-2xl bg-surface-interactive p-3.5">
          <p className="text-micro font-bold uppercase tracking-[0.08em] text-brand">Host&apos;s answer</p>
          <p className="selectable mt-1.5 whitespace-pre-wrap text-[15px] leading-[1.5] text-fg">{e.answer}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-supporting font-semibold text-muted">
        {reactSlot ?? (onReact && (
          <button type="button" onClick={() => onReact(e)} disabled={!canReact && false} className={`inline-flex items-center gap-1.5 transition-transform active:scale-90 ${mine ? "text-like" : "hover:text-fg"}`}>
            <Icon name={reactField === "upvotes_count" ? "star" : "heart"} filled={mine} className="size-[18px]" />
            {count > 0 ? count : reactField === "upvotes_count" ? "Upvote" : ""}
          </button>
        ))}
        {canReply && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 hover:text-fg">
            <Icon name="reply" className="size-[18px]" />
            {e.replies_count > 0 ? `${e.replies_count} ${e.replies_count === 1 ? "reply" : "replies"}` : "Reply"}
          </button>
        )}
        {onShare && <button type="button" onClick={() => onShare(e)} className="inline-flex items-center gap-1.5 hover:text-fg"><Icon name="share" className="size-[18px]" />Share</button>}
        {onReport && !e.is_mine && <button type="button" onClick={() => onReport(e)} className="hover:text-fg">Report</button>}
        {onRemove && <button type="button" onClick={() => onRemove(e)} className="hover:text-danger">Remove</button>}
        {actions}
      </div>
      {footer}
      {open && (
        <div className="mt-3 border-l-2 border-white/10 pl-4">
          {(replies.data ?? []).map((r) => (
            <div key={r.id} className="py-2">
              <div className="flex items-center gap-2"><Byline e={r} size={24} /><span className="text-supporting text-muted">{timeAgo(r.created_at)}</span></div>
              <p className="selectable mt-1 whitespace-pre-wrap text-[14px] leading-[1.45] text-fg">{r.body}</p>
            </div>
          ))}
          <div className="mt-2"><Composer placeholder="Write a reply" cta="Reply" max={500} allowAnon={allowAnon} busy={sending} onSend={reply} autoFocus /></div>
        </div>
      )}
    </div>
  );
}

export function Gate({ m, onJoined }: { m: Moment; onJoined: () => void }) {
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const v = m.viewer;
  if (v.is_member && !v.blocked && !v.muted) return null;
  async function join() {
    setBusy(true);
    try {
      const r = await communitiesApi.join(m.community.id);
      show(r.status === "requested" || r.status === "already_requested" ? "Request sent. You'll be notified." : "Joined");
      onJoined();
    } catch (e) {
      show(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  let body: ReactNode;
  if (!v.authenticated) {
    body = (<><p className="text-[15px] font-bold text-fg">Sign in to take part</p>
      <p className="mt-1 text-secondary leading-[1.4] text-muted">New to Anaija? Signing in creates your account, then brings you right back here.</p>
      <Link href={`/login?next=${encodeURIComponent(`/m/${m.code}`)}`} className={buttonClass("primary", "mt-3 h-11 px-6")}>Continue</Link></>);
  } else if (!v.is_member) {
    body = v.join === "invite" ? (<><p className="text-[15px] font-bold text-fg">{m.community.name} is invite-only</p>
      <p className="mt-1 text-secondary leading-[1.4] text-muted">Ask for the community invitation link to take part.</p></>) : (
      <><p className="text-[15px] font-bold text-fg">Join {m.community.name} to take part</p>
        <p className="mt-1 text-secondary leading-[1.4] text-muted">{v.join === "request" ? "A moderator approves new members." : "It takes one tap."}</p>
        <button type="button" disabled={busy} onClick={() => void join()} className={buttonClass("primary", "mt-3 h-11 px-6")}>{v.join === "request" ? "Request to join" : "Join community"}</button></>);
  } else if (v.blocked) body = <p className="text-[15px] font-bold text-fg">You can&apos;t take part in this Moment.</p>;
  else body = <p className="text-[15px] font-bold text-fg">You&apos;re muted in this community right now.</p>;
  return <div className="rounded-[20px] bg-surface-subtle p-4">{body}{toast}</div>;
}

export function MomentShare({ m, onClose, note }: { m: Moment; onClose: () => void; note?: string }) {
  const url = momentUrl(m.code);
  const line = shareLine(m);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Sheet title="Share this Moment" onClose={onClose}>
      <p className="px-1 text-[15px] font-semibold leading-[1.4] text-fg">{line}</p>
      {note && <p className="mt-1 px-1 text-secondary text-muted">{note}</p>}
      <p className="selectable mt-4 break-all rounded-2xl bg-surface-interactive p-4 text-[14px] font-semibold text-fg">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={async () => { const r = await shareLink(url, line); if (r === "copied") setMsg("Link copied"); }} className={buttonClass("primary", "h-11 px-5")}>Share / copy link</button>
        <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${line}\n${url}`)}`, "_blank", "noopener")} className={buttonClass("outline", "h-11 px-5")}>WhatsApp</button>
      </div>
      {msg && <p className="mt-3 text-center text-secondary text-muted">{msg}</p>}
    </Sheet>
  );
}

export function MomentCard({ c, compact = false }: { c: MomentCardData; compact?: boolean }) {
  const t = TYPE_META[c.type];
  let meta = `${c.participants_count} taking part`;
  if (c.status === "scheduled" && c.starts_at) meta = `Starts ${fmtWhen(c.starts_at)}`;
  else if (c.type === "confession_drop" && c.reveal_at && c.status !== "completed") meta = `Reveal ${fmtWhen(c.reveal_at)}`;
  else if (c.status === "draft") meta = "Waiting for a response";
  return (
    <Link href={c.path} className={`mo-in block rounded-[22px] bg-surface-subtle p-4 transition-colors hover:bg-surface-interactive active:scale-[0.99] ${compact ? "w-[250px] shrink-0" : ""}`}>
      <div className="flex items-start gap-3">
        <TypeIcon type={c.type} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-micro font-bold uppercase tracking-[0.08em]" style={{ color: t.color }}>{t.title}{c.is_official ? " · Official" : ""}</p>
          <p className="mt-1 line-clamp-2 text-[15px] font-bold leading-[1.25] text-fg">{c.title ?? t.title}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-supporting text-muted"><StatusPill type={c.type} status={c.status} /><span className="truncate">{meta}</span></div>
    </Link>
  );
}

export const IconRow = ({ icon, children }: { icon: IconName; children: ReactNode }) => (
  <p className="flex items-center gap-2 text-secondary text-muted"><Icon name={icon} className="size-4" />{children}</p>
);
