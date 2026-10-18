"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { commentsApi, type Comment } from "@/lib/api/comments";
import { useAuth } from "@/lib/auth/auth-context";
import { timeAgo } from "@/lib/format";

type Top = { items: Comment[]; cursor: string | null; hasMore: boolean; loading: boolean; more: boolean; error: string | null };
type Thread = { items: Comment[]; expanded: boolean; loaded: boolean; loading: boolean; hasMore: boolean; cursor: string | null };

const EMPTY_THREAD: Thread = { items: [], expanded: false, loaded: false, loading: false, hasMore: false, cursor: null };
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
// Optimistic comments get a unique negative id until the server returns the real one.
let tempSeq = 0;
const nextTempId = () => -++tempSeq;
const merge = (a: Comment[], b: Comment[]) => {
  const seen = new Set(a.map((c) => c.id));
  return [...a, ...b.filter((c) => !seen.has(c.id))];
};

function Row({
  c,
  small,
  mine,
  onLike,
  onReply,
  onDelete,
}: {
  c: Comment;
  small?: boolean;
  mine: boolean;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const href = c.author.username ? `/u/${c.author.username}` : null;
  const who = <span className={`font-bold text-fg ${small ? "text-[12.5px]" : "text-[13px]"}`}>{c.author.username}</span>;
  const act = "text-[11.5px] font-semibold text-muted";
  return (
    <div className={`flex gap-2.5 py-2 ${small ? "pl-[58px] pr-4" : "px-4"} ${c.pending ? "opacity-70" : ""}`}>
      <Avatar url={c.author.avatar} name={c.author.name ?? c.author.username} size={small ? 26 : 36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {href ? <Link href={href}>{who}</Link> : who}
          <span className="text-[11px] text-muted">{c.pending ? "Posting…" : timeAgo(c.created_at)}</span>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap break-words text-fg/95 ${small ? "text-[13px]" : "text-[13.5px]"} leading-[1.4]`}>
          {c.body}
        </p>
        <div className="mt-1.5 flex items-center gap-4">
          <button type="button" disabled={c.pending} onClick={onLike} className={`flex items-center gap-1 ${act} ${c.is_liked ? "!text-danger" : ""}`}>
            <Icon name="heart" filled={c.is_liked} className="size-3.5" />
            {c.likes_count > 0 && c.likes_count}
          </button>
          <button type="button" disabled={c.pending} onClick={onReply} className={act}>
            Reply
          </button>
          {mine && !c.pending && (
            <button type="button" onClick={onDelete} className={`${act} opacity-80`}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentsSheet({
  postId,
  initialCount,
  onCountChange,
  onClose,
}: {
  postId: number;
  initialCount: number;
  onCountChange: (n: number) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [top, setTop] = useState<Top>({ items: [], cursor: null, hasMore: false, loading: true, more: false, error: null });
  const [threads, setThreads] = useState<Record<number, Thread>>({});
  const [count, setCount] = useState(initialCount);
  const countRef = useRef(initialCount);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ username: string; parentId: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    commentsApi
      .list(postId)
      .then((r) => {
        if (off) return;
        setTop({ items: r.data ?? [], cursor: r.next_cursor ?? null, hasMore: !!r.has_more, loading: false, more: false, error: null });
      })
      .catch((e: unknown) => {
        if (!off) setTop((t) => ({ ...t, loading: false, error: msg(e) }));
      });
    return () => {
      off = true;
    };
  }, [postId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function flash(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(null), 1800);
  }
  function bump(d: number) {
    const n = Math.max(0, countRef.current + d);
    countRef.current = n;
    setCount(n);
    onCountChange(n);
  }
  const setTopItem = (id: number, fn: (c: Comment) => Comment) =>
    setTop((t) => ({ ...t, items: t.items.map((c) => (c.id === id ? fn(c) : c)) }));
  const setThread = (pid: number, fn: (t: Thread) => Thread) =>
    setThreads((m) => ({ ...m, [pid]: fn(m[pid] ?? EMPTY_THREAD) }));

  async function loadMore() {
    if (top.more || !top.hasMore || !top.cursor) return;
    setTop((t) => ({ ...t, more: true }));
    try {
      const r = await commentsApi.list(postId, top.cursor);
      setTop((t) => ({ ...t, items: merge(t.items, r.data ?? []), cursor: r.next_cursor ?? null, hasMore: !!r.has_more, more: false }));
    } catch {
      setTop((t) => ({ ...t, more: false }));
    }
  }

  async function loadThread(pid: number, cursor: string | null) {
    setThread(pid, (t) => ({ ...t, loading: true }));
    try {
      const r = await commentsApi.replies(pid, cursor);
      setThread(pid, (t) => ({
        ...t,
        items: merge(t.items, r.data ?? []),
        cursor: r.next_cursor ?? null,
        hasMore: !!r.has_more,
        loading: false,
        loaded: true,
      }));
    } catch {
      setThread(pid, (t) => ({ ...t, loading: false }));
    }
  }

  function toggleThread(pid: number) {
    const th = threads[pid];
    if (th?.expanded) {
      setThread(pid, (t) => ({ ...t, expanded: false }));
      return;
    }
    setThread(pid, (t) => ({ ...t, expanded: true }));
    if (!th?.loaded) void loadThread(pid, null);
  }

  async function like(c: Comment, parentId: number | null) {
    if (c.pending || c.id < 0) return;
    const apply = (fn: (x: Comment) => Comment) =>
      parentId === null ? setTopItem(c.id, fn) : setThread(parentId, (t) => ({ ...t, items: t.items.map((x) => (x.id === c.id ? fn(x) : x)) }));
    const liked = !c.is_liked;
    apply((x) => ({ ...x, is_liked: liked, likes_count: Math.max(0, x.likes_count + (liked ? 1 : -1)) }));
    try {
      const r = await commentsApi.like(c.id);
      apply((x) => ({ ...x, is_liked: r.liked, likes_count: r.likes_count }));
    } catch {
      apply(() => c);
    }
  }

  async function remove(c: Comment, parentId: number | null) {
    if (!window.confirm("Delete this comment? This can't be undone.")) return;
    if (parentId === null) {
      const prev = top.items;
      setTop((t) => ({ ...t, items: t.items.filter((x) => x.id !== c.id) }));
      bump(-1);
      try {
        await commentsApi.remove(c.id);
      } catch {
        setTop((t) => ({ ...t, items: prev }));
        bump(1);
        flash("Couldn't delete");
      }
      return;
    }
    const prev = threads[parentId]?.items ?? [];
    setThread(parentId, (t) => ({ ...t, items: t.items.filter((x) => x.id !== c.id) }));
    setTopItem(parentId, (x) => ({ ...x, replies_count: Math.max(0, x.replies_count - 1) }));
    try {
      await commentsApi.remove(c.id);
    } catch {
      setThread(parentId, (t) => ({ ...t, items: prev }));
      setTopItem(parentId, (x) => ({ ...x, replies_count: x.replies_count + 1 }));
      flash("Couldn't delete");
    }
  }

  function startReply(username: string | null, parentId: number) {
    if (!username) return;
    setReplyTo({ username, parentId });
    setText(`@${username} `);
    inputRef.current?.focus();
  }

  async function submit() {
    const body = text.trim();
    if (!body || !user) return;
    const author = { id: user.id, name: user.name, username: user.username, avatar: user.avatar };
    const temp: Comment = {
      id: nextTempId(),
      body,
      likes_count: 0,
      replies_count: 0,
      is_liked: false,
      created_at: new Date().toISOString(),
      author,
      pending: true,
    };
    const target = replyTo;
    setText("");
    setReplyTo(null);

    if (target) {
      const pid = target.parentId;
      if (!threads[pid]?.loaded) await loadThread(pid, null);
      setThread(pid, (t) => ({ ...t, expanded: true, items: [...t.items, temp] }));
      try {
        const real = await commentsApi.create(postId, body, pid);
        setThread(pid, (t) => ({ ...t, items: t.items.map((x) => (x.id === temp.id ? real : x)) }));
        setTopItem(pid, (x) => ({ ...x, replies_count: x.replies_count + 1 }));
      } catch (e) {
        setThread(pid, (t) => ({ ...t, items: t.items.filter((x) => x.id !== temp.id) }));
        flash(msg(e));
      }
      return;
    }

    setTop((t) => ({ ...t, items: [temp, ...t.items] }));
    bump(1);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const real = await commentsApi.create(postId, body);
      setTop((t) => ({ ...t, items: t.items.map((x) => (x.id === temp.id ? real : x)) }));
    } catch (e) {
      setTop((t) => ({ ...t, items: t.items.filter((x) => x.id !== temp.id) }));
      bump(-1);
      flash(msg(e));
    }
  }

  const linkBtn = "py-1.5 text-xs font-semibold text-muted";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label="Comments">
      <button type="button" aria-label="Close comments" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div className="glass relative flex h-[75dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] md:rounded-[30px]">
        <div className="flex items-center justify-center gap-2 border-b border-line/70 px-4 py-3.5">
          <span className="text-[15px] font-bold tracking-tight text-fg">Comments</span>
          <span className="rounded-[10px] bg-white/8 px-2 py-0.5 text-xs font-bold text-white/70">{count}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 grid size-9 place-items-center text-white/60">
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>

        <div ref={listRef} className="no-scrollbar flex-1 overflow-y-auto py-2">
          {top.loading ? (
            <p className="py-16 text-center text-sm text-muted">Loading…</p>
          ) : top.error ? (
            <p className="px-6 py-16 text-center text-sm text-muted">{top.error}</p>
          ) : top.items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-16">
              <Icon name="message" filled className="mb-2 size-9 text-white/50" />
              <p className="text-[15px] font-bold text-fg">No comments yet</p>
              <p className="text-[13px] text-muted">Start the conversation</p>
            </div>
          ) : (
            top.items.map((c) => {
              const th = threads[c.id];
              const n = c.replies_count;
              return (
                <div key={c.id}>
                  <Row
                    c={c}
                    mine={user?.id === c.author.id}
                    onLike={() => void like(c, null)}
                    onReply={() => startReply(c.author.username, c.id)}
                    onDelete={() => void remove(c, null)}
                  />
                  {th?.expanded &&
                    th.items.map((r) => (
                      <Row
                        key={r.id}
                        c={r}
                        small
                        mine={user?.id === r.author.id}
                        onLike={() => void like(r, c.id)}
                        onReply={() => startReply(r.author.username, c.id)}
                        onDelete={() => void remove(r, c.id)}
                      />
                    ))}
                  {!c.pending && (n > 0 || (th?.items.length ?? 0) > 0) && (
                    <div className="flex items-center gap-5 pb-1 pl-[58px] pr-4">
                      {!th?.expanded ? (
                        <button type="button" onClick={() => toggleThread(c.id)} className={linkBtn}>
                          — {n === 1 ? "View 1 reply" : `View ${n} replies`}
                        </button>
                      ) : (
                        <>
                          {th.loading ? (
                            <span className={linkBtn}>Loading…</span>
                          ) : (
                            th.hasMore && (
                              <button type="button" onClick={() => void loadThread(c.id, th.cursor)} className={linkBtn}>
                                — View more replies
                              </button>
                            )
                          )}
                          <button type="button" onClick={() => toggleThread(c.id)} className={linkBtn}>
                            Hide replies
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {top.hasMore && !top.loading && (
            <div className="grid place-items-center py-3">
              <button type="button" onClick={() => void loadMore()} disabled={top.more} className="text-[13px] font-semibold text-muted disabled:opacity-60">
                {top.more ? "Loading…" : "Load more comments"}
              </button>
            </div>
          )}
        </div>

        {toast && (
          <div className="absolute inset-x-0 bottom-20 flex justify-center">
            <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white">{toast}</span>
          </div>
        )}

        <div className="border-t border-line/70 bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {replyTo && (
            <div className="flex items-center justify-between bg-card px-4 py-1.5 text-xs font-semibold text-white/70">
              <span>Replying to @{replyTo.username}</span>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={() => {
                  setReplyTo(null);
                  setText((t) => (t.startsWith("@") ? "" : t));
                }}
              >
                <Icon name="close" className="size-4 text-muted" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Avatar url={user?.avatar} name={user?.name ?? user?.username} size={34} />
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Add a comment..."}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-full border border-line/60 bg-card px-4 py-2.5 text-sm text-fg outline-none placeholder:text-muted focus:border-white/30"
            />
            <button
              type="button"
              aria-label="Send"
              disabled={!text.trim()}
              onClick={() => void submit()}
              className="grid size-[38px] shrink-0 place-items-center rounded-full bg-white text-black transition disabled:bg-white/8 disabled:text-white/25"
            >
              <Icon name="send" filled className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
