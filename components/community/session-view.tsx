"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Toggle, useToast } from "@/components/settings/settings-kit";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type SessionInfo, type SessionPost, type SessionReport } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { timeAgo } from "@/lib/format";
import { useInterval } from "@/lib/messaging/use-interval";
import { subscribeBroadcast } from "@/lib/realtime/client";
import { confirmDialog } from "@/lib/ui/dialog";
import { AREA, Empty, ReportSheet, Sheet, StatusChip, messageOf, shareLink, siteUrl, useFetch } from "./kit";

// Anonymous presentation: a per-session alias and a colour. Never a profile component.
function AliasDot({ alias }: { alias: string }) {
  const n = parseInt(alias.replace(/\D/g, ""), 10) || 0;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-black" style={{ background: `hsl(${(n * 47) % 360} 70% 72%)` }}>
      {String(n).slice(-2)}
    </span>
  );
}

function Gate({ s, code, onJoined }: { s: SessionInfo; code: string; onJoined: () => void }) {
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);
  const v = s.viewer;
  const next = `/s/${code}`;
  async function join() {
    setBusy(true);
    try {
      const r = await communitiesApi.join(s.community.id);
      show(r.status === "requested" || r.status === "already_requested" ? "Request sent. You'll be notified." : "Joined");
      onJoined();
    } catch (e) {
      show(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  let body: React.ReactNode = null;
  if (!v.authenticated) {
    body = (
      <>
        <p className="text-[15px] font-bold text-fg">Sign in to post, react and reply</p>
        <p className="mt-1 text-secondary leading-[1.4] text-muted">New to Anaija? Signing in creates your account, then brings you right back to this session.</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass("primary", "mt-3 h-11 px-6")}>Continue</Link>
      </>
    );
  } else if (!v.is_member) {
    body = v.join === "invite" ? (
      <>
        <p className="text-[15px] font-bold text-fg">{s.community.name} is invite-only</p>
        <p className="mt-1 text-secondary leading-[1.4] text-muted">Ask the host for the community invitation link to take part.</p>
      </>
    ) : (
      <>
        <p className="text-[15px] font-bold text-fg">Join {s.community.name} to take part</p>
        <p className="mt-1 text-secondary leading-[1.4] text-muted">{v.join === "request" ? "A moderator approves new members." : "It takes one tap."}</p>
        <button type="button" disabled={busy} onClick={() => void join()} className={buttonClass("primary", "mt-3 h-11 px-6")}>{v.join === "request" ? "Request to join" : "Join community"}</button>
      </>
    );
  } else if (s.status === "scheduled") {
    body = <p className="text-[15px] font-bold text-fg">This session hasn&apos;t started yet{s.starts_at ? ` · starts ${new Date(s.starts_at).toLocaleString()}` : ""}</p>;
  } else if (s.status === "ended") {
    body = <p className="text-[15px] font-bold text-fg">This session has ended. You can still read everything.</p>;
  } else if (v.blocked) {
    body = <p className="text-[15px] font-bold text-fg">You can&apos;t post in this session.</p>;
  } else if (v.muted) {
    body = <p className="text-[15px] font-bold text-fg">You&apos;re muted in this community right now.</p>;
  }
  if (!body) return null;
  return <div className="rounded-[20px] bg-surface-subtle p-4">{body}{toast}</div>;
}

function Composer({ placeholder, busy, onSend, autoFocus = false }: { placeholder: string; busy: boolean; onSend: (t: string) => Promise<boolean>; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  async function go() {
    const t = text.trim();
    if (!t || busy) return;
    if (await onSend(t)) setText("");
  }
  return (
    <div>
      <textarea
        className={`${AREA} min-h-[88px]`}
        autoFocus={autoFocus}
        maxLength={1000}
        placeholder={placeholder}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go(); }}
      />
      <div className="mt-2 flex items-center">
        <span className="flex-1 px-2 text-supporting text-muted">{text.length}/1000</span>
        <button type="button" disabled={!text.trim() || busy} onClick={() => void go()} className={buttonClass("primary", "h-10 px-5")}>{busy ? "Posting…" : "Post anonymously"}</button>
      </div>
    </div>
  );
}

function PostCard({ s, code, post, onChanged, onReport, onModerate, reply = false }: {
  s: SessionInfo; code: string; post: SessionPost; onChanged: () => void; onReport: (p: SessionPost) => void; onModerate: (p: SessionPost) => void; reply?: boolean;
}) {
  const { toast, show } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sig = `${post.reactions_count}|${post.my_reaction}`;
  const [ov, setOv] = useState<{ sig: string; mine: string | null; count: number } | null>(null);
  const mine = ov && ov.sig === sig ? ov.mine : post.my_reaction;
  const count = ov && ov.sig === sig ? ov.count : post.reactions_count;
  const replies = useFetch(open ? `sr:${code}:${post.id}` : null, () => communitiesApi.sessionReplies(code, post.id));
  const v = s.viewer;

  async function react() {
    if (!v.can_react) return show(v.authenticated ? "Join the community to react" : "Sign in to react");
    const was = mine === "like";
    setOv({ sig, mine: was ? null : "like", count: count + (was ? -1 : 1) });
    try {
      const r = await communitiesApi.sessionReact(code, post.id, "like");
      setOv({ sig, mine: r.my_reaction, count: r.reactions_count });
    } catch (e) {
      setOv(null);
      show(messageOf(e));
    }
  }
  async function send(body: string) {
    setSending(true);
    try {
      await communitiesApi.sessionPost(code, { body, parent_id: post.id });
      replies.reload();
      onChanged();
      return true;
    } catch (e) {
      show(messageOf(e));
      return false;
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={reply ? "flex gap-3 py-2" : "rounded-[22px] bg-surface-subtle p-4"}>
      {reply && <AliasDot alias={post.alias} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          {!reply && <AliasDot alias={post.alias} />}
          <span className="text-[14px] font-bold text-fg">{post.alias}</span>
          {post.is_mine && <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-micro font-bold text-brand">You</span>}
          <span className="text-supporting text-muted">{timeAgo(post.created_at)}</span>
        </div>
        <p className={`selectable whitespace-pre-wrap break-words text-[15px] leading-[1.5] text-fg ${reply ? "mt-1" : "mt-2.5"}`}>{post.body}</p>
        <div className="mt-2.5 flex items-center gap-5 text-supporting font-semibold text-muted">
          {s.reactions_enabled && (
            <button type="button" onClick={() => void react()} className={`inline-flex items-center gap-1.5 ${mine ? "text-like" : "hover:text-fg"}`}>
              <Icon name="heart" filled={!!mine} className="size-[18px]" />
              {count > 0 ? count : ""}
            </button>
          )}
          {!reply && s.replies_enabled && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 hover:text-fg">
              <Icon name="reply" className="size-[18px]" />
              {post.replies_count > 0 ? `${post.replies_count} ${post.replies_count === 1 ? "reply" : "replies"}` : "Reply"}
            </button>
          )}
          {v.authenticated && v.is_member && !post.is_mine && <button type="button" onClick={() => onReport(post)} className="hover:text-fg">Report</button>}
          {v.can_moderate && <button type="button" onClick={() => onModerate(post)} className="hover:text-danger">Remove</button>}
        </div>
        {open && (
          <div className="mt-3 border-l-2 border-white/10 pl-4">
            {replies.loading && <Sk className="h-10 w-full rounded-xl" />}
            {(replies.data ?? []).map((r) => (
              <PostCard key={r.id} s={s} code={code} post={r} reply onChanged={() => { replies.reload(); onChanged(); }} onReport={onReport} onModerate={onModerate} />
            ))}
            {v.can_reply && <div className="mt-2"><Composer placeholder="Reply anonymously" busy={sending} onSend={send} autoFocus /></div>}
          </div>
        )}
        {toast}
      </div>
    </div>
  );
}

function ModerateSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string, block: boolean) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(reason.trim(), block);
      onClose();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <Sheet title="Remove post" onClose={onClose}>
      <textarea className={`${AREA} min-h-[80px]`} maxLength={200} placeholder="Reason (optional, kept in the moderation log)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-3">
        <Group><Toggle icon="forbidden" label="Also block this participant here (you won't see who they are)" value={block} onChange={setBlock} /></Group>
      </div>
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => void go()} className="mt-5 h-12 w-full rounded-full bg-danger text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? "Removing…" : "Remove post"}</button>
    </Sheet>
  );
}

function ReportsSheet({ code, onClose, onChanged }: { code: string; onClose: () => void; onChanged: () => void }) {
  const q = useFetch(`srep:${code}`, () => communitiesApi.sessionReports(code));
  const [err, setErr] = useState<string | null>(null);
  async function handle(r: SessionReport, action: "dismiss" | "remove", block = false) {
    setErr(null);
    try {
      await communitiesApi.sessionReportHandle(code, { report_id: r.id, action, block });
      q.patch((l) => l.filter((x) => x.id !== r.id));
      if (action === "remove") onChanged();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  return (
    <Sheet title="Session reports" onClose={onClose} wide>
      {q.loading ? <p className="py-8 text-center text-secondary text-muted">Loading…</p> : !q.data?.length ? <p className="py-10 text-center text-secondary text-muted">No open reports.</p> : (
        <div className="space-y-2">
          {q.data.map((r) => (
            <div key={r.id} className="rounded-[20px] bg-surface-interactive/60 p-3">
              <p className="text-supporting font-bold uppercase tracking-wide text-muted">{r.reason} · {r.preview.alias}</p>
              <p className="mt-1.5 line-clamp-4 text-body leading-[1.4] text-fg">{r.preview.body}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => void handle(r, "remove")} className="h-9 rounded-full bg-danger/90 px-4 text-secondary font-bold text-white">Remove</button>
                <button type="button" onClick={() => void handle(r, "remove", true)} className="h-9 rounded-full bg-surface-elevated px-4 text-secondary font-bold text-fg">Remove + block</button>
                <button type="button" onClick={() => void handle(r, "dismiss")} className="h-9 rounded-full px-4 text-secondary font-bold text-muted">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
    </Sheet>
  );
}

export function SessionView({ code }: { code: string }) {
  const { status } = useAuth();
  const { toast, show } = useToast();
  const sess = useFetch(status === "loading" ? null : `s:${code}:${status}`, () => communitiesApi.session(code));
  const s = sess.data;
  const feedKey = s?.viewer.can_view ? `sf:${code}:${status}` : null;
  const feed = useFetch(feedKey, () => communitiesApi.sessionFeed(code, null));
  const [extra, setExtra] = useState<{ key: string; items: SessionPost[]; cursor: string | null } | null>(null);
  const [local, setLocal] = useState<SessionPost[]>([]);
  const [gone, setGone] = useState<number[]>([]);
  const [posting, setPosting] = useState(false);
  const [report, setReport] = useState<SessionPost | null>(null);
  const [mod, setMod] = useState<SessionPost | null>(null);
  const [reports, setReports] = useState(false);

  const { reload: reloadSess } = sess;
  const { reload: reloadFeed } = feed;
  const refresh = useCallback(() => { reloadSess(); reloadFeed(); }, [reloadSess, reloadFeed]);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  // Realtime carries only a "something changed" hint; the client refetches (no content, no identities over the wire).
  const rt = s?.realtime_key ?? null;
  useEffect(() => {
    if (!rt) return;
    let t: number | undefined;
    const off = subscribeBroadcast(`session:${rt}`, {
      changed: () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => refreshRef.current(), 400);
      },
    });
    return () => {
      window.clearTimeout(t);
      off();
    };
  }, [rt]);
  useInterval(refresh, 20_000, !!s?.viewer.can_view && s.status !== "ended");

  const more = extra?.key === feedKey ? extra : null;
  const byId = new Map<number, SessionPost>();
  for (const p of [...(feed.data?.posts ?? []), ...(more?.items ?? []), ...local]) if (!byId.has(p.id)) byId.set(p.id, p);
  const items = [...byId.values()].filter((p) => !gone.includes(p.id)).sort((a, b) => b.id - a.id);
  const cursor = more ? more.cursor : (feed.data?.next_cursor ?? null);

  async function loadMore() {
    if (!feedKey || !cursor) return;
    try {
      const r = await communitiesApi.sessionFeed(code, cursor);
      setExtra({ key: feedKey, items: [...(more?.items ?? []), ...r.posts], cursor: r.next_cursor });
    } catch (e) {
      show(messageOf(e));
    }
  }
  async function post(body: string) {
    setPosting(true);
    try {
      const r = await communitiesApi.sessionPost(code, { body });
      setLocal((l) => [r.post, ...l]);
      reloadFeed();
      reloadSess();
      return true;
    } catch (e) {
      show(messageOf(e));
      return false;
    } finally {
      setPosting(false);
    }
  }
  async function end() {
    if (!(await confirmDialog({ title: "End this session?", message: "It becomes read-only. People can still read it from the link.", confirmLabel: "End session", danger: true }))) return;
    try {
      await communitiesApi.sessionEnd(code);
      refresh();
    } catch (e) {
      show(messageOf(e));
    }
  }
  async function share() {
    const r = await shareLink(`${siteUrl()}/s/${code}`, s?.title ?? "Session");
    if (r === "copied") show("Link copied");
  }

  if (!s) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 pt-3 md:pt-8">
        {sess.error ? (
          <Empty title="Session not found" body={sess.error}><Link href="/communities" className={buttonClass("primary", "h-10 px-5")}>Browse communities</Link></Empty>
        ) : (
          <div role="status" aria-busy="true" aria-label="Loading session" className="space-y-4">
            <Sk className="h-28 w-full rounded-[22px]" />
            <Sk className="h-24 w-full rounded-[22px]" />
            <Sk className="h-24 w-full rounded-[22px]" />
          </div>
        )}
      </div>
    );
  }
  const v = s.viewer;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-3 md:pt-8">
      <div className="rounded-[24px] bg-surface-subtle p-5">
        <Link href={`/c/${s.community.slug}`} className="flex items-center gap-2.5">
          <Avatar url={s.community.avatar} name={s.community.name} size={28} />
          <span className="truncate text-secondary font-bold text-muted hover:text-fg">{s.community.name}</span>
          <span className="ml-auto"><StatusChip status={s.status} /></span>
        </Link>
        <h1 className="mt-3 text-[24px] font-extrabold leading-[1.15] tracking-tight text-fg">{s.title}</h1>
        {s.description && <p className="mt-1.5 whitespace-pre-wrap text-body leading-[1.5] text-fg/80">{s.description}</p>}
        <p className="mt-3 text-supporting text-muted">
          {s.posts_count} {s.posts_count === 1 ? "post" : "posts"} · {s.participants_count} {s.participants_count === 1 ? "participant" : "participants"}
          {s.ends_at && s.status !== "ended" ? ` · ends ${new Date(s.ends_at).toLocaleString()}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void share()} className={buttonClass("outline", "h-10 px-4")}><Icon name="share" className="size-4" />Share link</button>
          {v.can_moderate && s.status !== "ended" && <button type="button" onClick={() => void end()} className={buttonClass("outline", "h-10 px-4")}>End session</button>}
          {v.can_moderate && <button type="button" onClick={() => setReports(true)} className={buttonClass("outline", "h-10 px-4")}>Reports</button>}
        </div>
        <p className="mt-3 text-supporting leading-[1.4] text-muted">
          Posts show a random name for this session, not your profile. Other participants and the host can&apos;t see who wrote what. Anaija keeps account-linked records so abuse can be handled.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {v.can_post ? <Composer placeholder="Say something anonymously" busy={posting} onSend={post} /> : <Gate s={s} code={code} onJoined={refresh} />}

        {!v.can_view ? (
          <Empty title="Join to see this session" body="This community keeps its sessions for members." />
        ) : feed.loading ? (
          <div role="status" aria-busy="true" aria-label="Loading posts" className="space-y-3">
            {[0, 1, 2].map((i) => <Sk key={i} className="h-24 w-full rounded-[22px]" />)}
          </div>
        ) : feed.error && items.length === 0 ? (
          <Empty title="Couldn't load the session" body={feed.error}><button type="button" onClick={refresh} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
        ) : items.length === 0 ? (
          <Empty title="No posts yet" body={v.can_post ? "Be the first to post. It's anonymous." : "Posts will appear here the moment they're sent."} />
        ) : (
          <>
            {items.map((p) => (
              <PostCard key={p.id} s={s} code={code} post={p} onChanged={refresh} onReport={setReport} onModerate={setMod} />
            ))}
            {cursor && <button type="button" onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto h-10")}>Show older posts</button>}
          </>
        )}
      </div>

      {report && (
        <ReportSheet title="Report post" onClose={() => setReport(null)} onSubmit={(reason) => communitiesApi.sessionReport(code, { post_id: report.id, reason }).then(() => { show("Report sent"); })} />
      )}
      {mod && (
        <ModerateSheet
          onClose={() => setMod(null)}
          onSubmit={async (reason, block) => {
            await communitiesApi.sessionRemove(code, { post_id: mod.id, reason: reason || undefined, block });
            setGone((g) => [...g, mod.id]);
            refresh();
          }}
        />
      )}
      {reports && <ReportsSheet code={code} onClose={() => setReports(false)} onChanged={refresh} />}
      {toast}
    </div>
  );
}
