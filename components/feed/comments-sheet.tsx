"use client";
import { confirmDialog } from "@/lib/ui/dialog";
import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import { CommentsSkeleton } from "@/components/ui/skeleton";
import { ImageViewer, messageOf } from "@/components/community/kit";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { commentsApi, type Comment, type CommentMedia, type CommentMediaInput } from "@/lib/api/comments";
import { uploadBlob } from "@/lib/api/upload";
import { useAuth } from "@/lib/auth/auth-context";
import { onCacheClear } from "@/lib/cache/swr";
import { makePreview, normalizeImage, prepareImage } from "@/lib/create/image-pipeline";
import { timeAgo } from "@/lib/format";

type Top = { items: Comment[]; cursor: string | null; hasMore: boolean; loading: boolean; more: boolean; error: string | null };
type Thread = { items: Comment[]; expanded: boolean; loaded: boolean; loading: boolean; hasMore: boolean; cursor: string | null };

/** Course Desk question threads only: replies may carry images, own replies can be edited, the question can be marked answered. */
export interface QuestionCtx {
  resolved: boolean;
  canResolve: boolean;
  onResolved: (resolved: boolean) => void;
}

const EMPTY_THREAD: Thread = { items: [], expanded: false, loaded: false, loading: false, hasMore: false, cursor: null };
const MAX_IMAGES = 4; // server: MAX_COMMENT_IMAGES
const MAX_SOURCE_BYTES = 30 * 1024 * 1024; // the original; the uploaded feed copy is far smaller (server cap 10 MB)
const looksLikeImage = (f: File) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
const msg = messageOf;
// Optimistic comments get a unique negative id until the server returns the real one.
let tempSeq = 0;
const nextTempId = () => -++tempSeq;
const merge = (a: Comment[], b: Comment[]) => {
  const seen = new Set(a.map((c) => c.id));
  return [...a, ...b.filter((c) => !seen.has(c.id))];
};

interface Pic {
  id: string;
  file: File; // normalised: a stable key for the upload cache, so a retry never uploads it twice
  url: string; // light preview, never the original
}
const revoke = (ps: Pic[]) => ps.forEach((p) => URL.revokeObjectURL(p.url));

// First page of each post's comments, memory only: reopening a post's comments paints instantly and the fetch
// below reconciles it. Wiped on sign-out / account change.
type FirstPage = { items: Comment[]; cursor: string | null; hasMore: boolean };
const firstPages = new Map<number, FirstPage>();
onCacheClear(() => firstPages.clear());
function rememberFirst(postId: number, p: FirstPage) {
  firstPages.delete(postId);
  firstPages.set(postId, p);
  while (firstPages.size > 30) {
    const oldest = firstPages.keys().next().value;
    if (oldest === undefined) break;
    firstPages.delete(oldest);
  }
}

function Media({ items, small, onOpen }: { items: CommentMedia[]; small?: boolean; onOpen: (url: string) => void }) {
  if (!items.length) return null;
  const one = items.length === 1;
  return (
    <div className={`mt-2 grid gap-1.5 ${one ? "grid-cols-1" : "grid-cols-2"} ${small ? "max-w-[220px]" : "max-w-[300px]"}`}>
      {items.map((m) => (
        <button key={m.id} type="button" aria-label="View image" onClick={() => onOpen(m.url)} className="overflow-hidden rounded-2xl bg-surface-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url} alt="" loading="lazy" className={`w-full object-cover ${one ? "max-h-64" : "aspect-square"}`} />
        </button>
      ))}
    </div>
  );
}

function Row({
  c,
  small,
  mine,
  editable,
  editing,
  onLike,
  onReply,
  onDelete,
  onEdit,
  onImage,
}: {
  c: Comment;
  small?: boolean;
  mine: boolean;
  editable: boolean;
  editing: { text: string; busy: boolean; onText: (t: string) => void; onSave: () => void; onCancel: () => void } | null;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onImage: (url: string) => void;
}) {
  const href = c.author.username ? `/u/${c.author.username}` : null;
  const who = <span className="text-secondary font-bold text-fg">{c.author.username}</span>;
  const act = "text-supporting font-semibold text-muted";
  return (
    <div data-comment-id={c.id} className={`flex gap-2.5 py-2 ${small ? "pl-[58px] pr-4" : "px-4"} ${c.pending ? "opacity-70" : ""}`}>
      <ProfileHoverCard username={c.author.username}><Avatar url={c.author.avatar} name={c.author.name ?? c.author.username} size={small ? 26 : 36} /></ProfileHoverCard>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {href ? <Link href={href}>{who}</Link> : who}
          <span className="text-micro text-muted">
            {c.pending ? "Posting…" : timeAgo(c.created_at)}
            {c.edited_at && !c.pending ? " · edited" : ""}
          </span>
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              rows={2}
              maxLength={1000}
              value={editing.text}
              disabled={editing.busy}
              onChange={(e) => editing.onText(e.target.value)}
              className="w-full resize-none rounded-2xl bg-surface-interactive px-3.5 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60"
            />
            <div className="mt-1.5 flex items-center gap-4">
              <button type="button" disabled={editing.busy || !editing.text.trim()} onClick={editing.onSave} className="text-supporting font-extrabold text-brand-ink disabled:opacity-50">
                {editing.busy ? "Saving…" : "Save"}
              </button>
              <button type="button" disabled={editing.busy} onClick={editing.onCancel} className={act}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={`mt-0.5 whitespace-pre-wrap break-words text-fg/95 ${small ? "text-secondary" : "text-body"} leading-[1.4]`}>{c.body}</p>
            <Media items={c.media ?? []} small={small} onOpen={onImage} />
          </>
        )}
        {!editing && (
          <div className="mt-1.5 flex items-center gap-4">
            <button type="button" disabled={c.pending} onClick={onLike} className={`flex items-center gap-1 ${act} ${c.is_liked ? "!text-like" : ""}`}>
              <Icon name="heart" filled={c.is_liked} className="size-3.5" />
              {c.likes_count > 0 && c.likes_count}
            </button>
            <button type="button" disabled={c.pending} onClick={onReply} className={act}>
              Reply
            </button>
            {mine && editable && !c.pending && (
              <button type="button" onClick={onEdit} className={act}>
                Edit
              </button>
            )}
            {mine && !c.pending && (
              <button type="button" onClick={onDelete} className={`${act} opacity-80`}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsSheet({
  postId,
  focusId,
  initialCount,
  onCountChange,
  onClose,
  question,
}: {
  postId: number;
  focusId?: number;
  initialCount: number;
  onCountChange: (n: number) => void;
  onClose: () => void;
  question?: QuestionCtx;
}) {
  const { user } = useAuth();
  const isQ = !!question;
  const [top, setTop] = useState<Top>(() => {
    const c = firstPages.get(postId);
    return c
      ? { items: c.items, cursor: c.cursor, hasMore: c.hasMore, loading: false, more: false, error: null }
      : { items: [], cursor: null, hasMore: false, loading: true, more: false, error: null };
  });
  const [threads, setThreads] = useState<Record<number, Thread>>({});
  const [count, setCount] = useState(initialCount);
  const countRef = useRef(initialCount);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ username: string; parentId: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pics, setPics] = useState<Pic[]>([]);
  const [reading, setReading] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: number; parentId: number | null; text: string; busy: boolean } | null>(null);
  const [resolved, setResolved] = useState(question?.resolved ?? false);
  const [resolving, setResolving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const picsRef = useRef<Pic[]>([]);
  picsRef.current = pics;
  const viewerOpen = useRef(false);
  viewerOpen.current = viewer !== null;
  // Uploaded images are remembered per File, so a failed send that is retried never uploads twice.
  const uploaded = useRef(new WeakMap<File, CommentMediaInput>());

  useEffect(() => () => revoke(picsRef.current), []);

  // Always reconcile with the server, even when a cached page is already on screen.
  useEffect(() => {
    let off = false;
    commentsApi
      .list(postId)
      .then((r) => {
        if (off) return;
        const fresh = r.data ?? [];
        const cursor = r.next_cursor ?? null;
        const hasMore = !!r.has_more;
        rememberFirst(postId, { items: fresh, cursor, hasMore });
        setTop((t) => ({ items: [...t.items.filter((c) => c.pending), ...fresh], cursor, hasMore, loading: false, more: false, error: null }));
      })
      .catch((e: unknown) => {
        if (off) return;
        setTop((t) => (t.items.length > 0 ? { ...t, loading: false } : { ...t, loading: false, error: msg(e) }));
      });
    return () => {
      off = true;
    };
  }, [postId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !viewerOpen.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function flash(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
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

  // Opened from a notification: find that comment (first page, then replies, then a few more pages),
  // expand its thread when it's a reply, and say so if it's gone.
  const searched = useRef(false);
  useEffect(() => {
    if (focusId === undefined || top.loading || top.error || searched.current) return;
    searched.current = true;
    let items = top.items;
    let cursor = top.cursor;
    let more = top.hasMore;
    const checked = new Set<number>();
    void (async () => {
      for (let round = 0; round < 4; round++) {
        if (items.some((c) => c.id === focusId)) return;
        const batch = items.filter((c) => c.replies_count > 0 && !checked.has(c.id)).slice(0, 12);
        batch.forEach((c) => checked.add(c.id));
        const found = await Promise.all(
          batch.map((c) => commentsApi.replies(c.id, null).then((r) => ({ c, r })).catch(() => null)),
        );
        for (const x of found) {
          if (x && (x.r.data ?? []).some((rep) => rep.id === focusId)) {
            const rows = x.r.data ?? [];
            const next = x.r.next_cursor ?? null;
            const hasMore = !!x.r.has_more;
            setThread(x.c.id, (t) => ({ ...t, items: merge(t.items, rows), cursor: next, hasMore, loaded: true, loading: false, expanded: true }));
            return;
          }
        }
        if (!more || !cursor) break;
        try {
          const r = await commentsApi.list(postId, cursor);
          const add = r.data ?? [];
          const nextCursor = r.next_cursor ?? null;
          const nextMore = !!r.has_more;
          items = merge(items, add);
          cursor = nextCursor;
          more = nextMore;
          setTop((t) => ({ ...t, items: merge(t.items, add), cursor: nextCursor, hasMore: nextMore }));
        } catch {
          break;
        }
      }
      if (!items.some((c) => c.id === focusId)) flash("That comment isn't available anymore");
    })();
  }, [focusId, top.loading, top.error, top.items, top.cursor, top.hasMore, postId]);

  // Once the row is on screen, scroll to it and fade a flat tint over it.
  const scrolled = useRef(false);
  useEffect(() => {
    if (focusId === undefined || scrolled.current) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-comment-id="${focusId}"]`);
    if (!el) return;
    scrolled.current = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("comment-flash");
    el.addEventListener("animationend", () => el.classList.remove("comment-flash"), { once: true });
  }, [focusId, top.items, threads]);

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
    if (!(await confirmDialog({ title: isQ ? "Delete this reply?" : "Delete comment?", message: "This can't be undone.", confirmLabel: "Delete", danger: true }))) return;
    if (parentId === null) {
      const prev = top.items;
      setTop((t) => ({ ...t, items: t.items.filter((x) => x.id !== c.id) }));
      bump(-1);
      try {
        await commentsApi.remove(c.id);
        const f = firstPages.get(postId);
        if (f) rememberFirst(postId, { ...f, items: f.items.filter((x) => x.id !== c.id) });
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

  async function saveEdit() {
    if (!edit || edit.busy) return;
    const body = edit.text.trim();
    if (!body) return;
    const { id, parentId } = edit;
    const current = parentId === null ? top.items.find((x) => x.id === id) : threads[parentId]?.items.find((x) => x.id === id);
    if (current && current.body === body) return setEdit(null);
    setEdit({ ...edit, busy: true });
    try {
      const real = await commentsApi.edit(id, body);
      const apply = (x: Comment): Comment => ({ ...x, body: real.body, edited_at: real.edited_at ?? new Date().toISOString() });
      if (parentId === null) setTopItem(id, apply);
      else setThread(parentId, (t) => ({ ...t, items: t.items.map((x) => (x.id === id ? apply(x) : x)) }));
      const f = firstPages.get(postId);
      if (f && parentId === null) rememberFirst(postId, { ...f, items: f.items.map((x) => (x.id === id ? apply(x) : x)) });
      setEdit(null);
    } catch (e) {
      flash(msg(e));
      setEdit((s) => (s ? { ...s, busy: false } : s));
    }
  }
  const editingFor = (c: Comment, parentId: number | null) =>
    edit && edit.id === c.id
      ? {
          text: edit.text,
          busy: edit.busy,
          onText: (t: string) => setEdit((s) => (s ? { ...s, text: t } : s)),
          onSave: () => void saveEdit(),
          onCancel: () => setEdit(null),
        }
      : null;
  void editingFor;

  async function toggleResolved() {
    if (!question || resolving) return;
    const next = !resolved;
    setResolving(true);
    setResolved(next);
    try {
      await commentsApi.resolve(postId, next);
      question.onResolved(next);
    } catch (e) {
      setResolved(!next);
      flash(msg(e));
    } finally {
      setResolving(false);
    }
  }

  function startReply(username: string | null, parentId: number) {
    if (!username) return;
    setReplyTo({ username, parentId });
    setText(`@${username} `);
    inputRef.current?.focus();
  }

  async function addPics(list: FileList | null) {
    if (!list || !list.length) return;
    const room = MAX_IMAGES - picsRef.current.length;
    const picked = [...list];
    if (picked.length > room) flash(`You can attach up to ${MAX_IMAGES} images.`);
    setReading(true);
    const next: Pic[] = [];
    try {
      for (const f of picked.slice(0, Math.max(0, room))) {
        if (!looksLikeImage(f)) {
          flash("Only images can be attached.");
          continue;
        }
        if (f.size > MAX_SOURCE_BYTES) {
          flash("An image is larger than 30 MB.");
          continue;
        }
        try {
          const file = await normalizeImage(f);
          const prev = await makePreview(file);
          next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(prev.blob) });
        } catch {
          flash("One of the images couldn't be read.");
        }
      }
    } finally {
      setReading(false);
    }
    if (next.length) setPics((p) => [...p, ...next].slice(0, MAX_IMAGES));
  }
  function dropPic(id: string) {
    setPics((p) => {
      const hit = p.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return p.filter((x) => x.id !== id);
    });
  }
  async function uploadPics(files: File[]): Promise<CommentMediaInput[]> {
    const out: CommentMediaInput[] = [];
    for (const f of files) {
      let m = uploaded.current.get(f);
      if (!m) {
        const p = await prepareImage(f);
        const key = await uploadBlob(p.feed, `feed.${p.ext}`, p.contentType);
        m = { storage_key: key, width: p.width, height: p.height, aspect_ratio: p.width / p.height, size_bytes: p.feed.size, mime_type: p.contentType };
        uploaded.current.set(f, m);
      }
      out.push(m);
    }
    return out;
  }

  async function submit() {
    const body = text.trim();
    if (!body || !user || reading) return;
    const author = { id: user.id, name: user.name, username: user.username, avatar: user.avatar };
    const sending = isQ ? pics : [];
    const files = sending.map((p) => p.file);
    const temp: Comment = {
      id: nextTempId(),
      body,
      likes_count: 0,
      replies_count: 0,
      is_liked: false,
      created_at: new Date().toISOString(),
      author,
      pending: true,
      media: sending.map((p) => ({ id: nextTempId(), url: p.url, width: null, height: null, aspect_ratio: null })),
    };
    const target = replyTo;
    setText("");
    setReplyTo(null);
    setPics([]);
    // A failed send puts the text and images back so one tap retries (uploaded images are not uploaded again).
    const restore = (e: unknown) => {
      setText((t) => t || body);
      setReplyTo((r) => r ?? target);
      setPics((p) => (p.length ? p : sending));
      flash(msg(e));
    };

    if (target) {
      const pid = target.parentId;
      if (!threads[pid]?.loaded) await loadThread(pid, null);
      setThread(pid, (t) => ({ ...t, expanded: true, items: [...t.items, temp] }));
      try {
        const media = files.length ? await uploadPics(files) : undefined;
        const real = await commentsApi.create(postId, body, pid, media);
        setThread(pid, (t) => ({ ...t, items: t.items.map((x) => (x.id === temp.id ? real : x)) }));
        setTopItem(pid, (x) => ({ ...x, replies_count: x.replies_count + 1 }));
        revoke(sending);
      } catch (e) {
        setThread(pid, (t) => ({ ...t, items: t.items.filter((x) => x.id !== temp.id) }));
        restore(e);
      }
      return;
    }

    setTop((t) => ({ ...t, items: [temp, ...t.items] }));
    bump(1);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const media = files.length ? await uploadPics(files) : undefined;
      const real = await commentsApi.create(postId, body, undefined, media);
      setTop((t) => ({ ...t, items: t.items.map((x) => (x.id === temp.id ? real : x)) }));
      const f = firstPages.get(postId);
      if (f) rememberFirst(postId, { ...f, items: [real, ...f.items] });
      revoke(sending);
    } catch (e) {
      setTop((t) => ({ ...t, items: t.items.filter((x) => x.id !== temp.id) }));
      bump(-1);
      restore(e);
    }
  }

  const rowProps = (c: Comment, parentId: number | null) => ({
    c,
    mine: user?.id === c.author.id,
    editable: isQ,
    editing: editingFor(c, parentId),
    onImage: setViewer,
    onEdit: () => setEdit({ id: c.id, parentId, text: c.body, busy: false }),
  });

  const linkBtn = "py-1.5 text-xs font-semibold text-muted";
  const noun = isQ ? "Answers" : "Comments";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={noun}>
      <button type="button" aria-label={`Close ${noun.toLowerCase()}`} onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div className="glass relative flex h-[75dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-sheet md:rounded-sheet">
        <div className="flex items-center justify-center gap-2 px-4 py-3.5">
          <span className="text-[15px] font-bold tracking-tight text-fg">{noun}</span>
          <span className="rounded-[10px] bg-white/8 px-2 py-0.5 text-xs font-bold text-white/70">{count}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 grid size-9 place-items-center text-white/60 hit-area">
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>

        {question && (
          <div className="flex items-center gap-3 px-4 pb-2">
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-micro font-extrabold uppercase tracking-wide ${
                resolved ? "bg-brand/15 text-brand-ink" : "bg-surface-interactive text-muted"
              }`}
            >
              {resolved && <Icon name="check" className="size-3.5" />}
              {resolved ? "Answered" : "Open"}
            </span>
            {question.canResolve && (
              <button type="button" disabled={resolving} onClick={() => void toggleResolved()} className="text-supporting font-bold text-brand-ink disabled:opacity-50">
                {resolved ? "Reopen question" : "Mark as answered"}
              </button>
            )}
          </div>
        )}

        <div ref={listRef} className="no-scrollbar flex-1 overflow-y-auto py-2">
          {top.loading ? (
            <CommentsSkeleton />
          ) : top.error ? (
            <p className="px-6 py-16 text-center text-sm text-muted">{top.error}</p>
          ) : top.items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-16">
              <Icon name="message" filled className="mb-2 size-9 text-white/50" />
              <p className="text-[15px] font-bold text-fg">{isQ ? "No answers yet" : "No comments yet"}</p>
              <p className="text-secondary text-muted">{isQ ? "Be the first to answer" : "Start the conversation"}</p>
            </div>
          ) : (
            top.items.map((c) => {
              const th = threads[c.id];
              const n = c.replies_count;
              return (
                <div key={c.id}>
                  <Row
                    {...rowProps(c, null)}
                    onLike={() => void like(c, null)}
                    onReply={() => startReply(c.author.username, c.id)}
                    onDelete={() => void remove(c, null)}
                  />
                  {th?.expanded &&
                    th.items.map((r) => (
                      <Row
                        key={r.id}
                        small
                        {...rowProps(r, c.id)}
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
                            <span role="status" aria-label="Loading replies" className="sk-block ml-9 mt-1 inline-block h-3 w-28 rounded-full align-middle" />
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
              <button type="button" onClick={() => void loadMore()} disabled={top.more} className="text-secondary font-semibold text-muted disabled:opacity-60">
                {top.more ? <span role="status" aria-label="Loading more" className="sk-block inline-block h-3 w-28 rounded-full align-middle" /> : isQ ? "Load more answers" : "Load more comments"}
              </button>
            </div>
          )}
        </div>

        {toast && (
          <div className="absolute inset-x-0 bottom-20 flex justify-center">
            <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white">{toast}</span>
          </div>
        )}

        <div className="bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
          {isQ && pics.length > 0 && (
            <div className="flex gap-2 px-3.5 pt-2.5">
              {pics.map((p, i) => (
                <div key={p.id} className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-surface-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Attachment ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    onClick={() => dropPic(p.id)}
                    className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-black/65 text-white"
                  >
                    <Icon name="close" className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {isQ && pics.length > 0 && !text.trim() && <p className="px-4 pt-1.5 text-supporting text-muted">Add a few words to send your images.</p>}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Avatar url={user?.avatar} name={user?.name ?? user?.username} size={34} />
            {isQ && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void addPics(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  aria-label="Attach images"
                  disabled={reading || pics.length >= MAX_IMAGES}
                  onClick={() => fileRef.current?.click()}
                  className="grid size-[38px] shrink-0 place-items-center rounded-full bg-surface-interactive text-fg disabled:opacity-40"
                >
                  {reading ? <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-transparent" /> : <Icon name="plus" className="size-4" />}
                </button>
              </>
            )}
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
              placeholder={replyTo ? `Reply to @${replyTo.username}...` : isQ ? "Write an answer..." : "Add a comment..."}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-full bg-surface-interactive px-4 py-2.5 text-sm font-medium text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60"
            />
            <button
              type="button"
              aria-label="Send"
              disabled={!text.trim() || reading}
              onClick={() => void submit()}
              className="grid size-[38px] shrink-0 place-items-center rounded-full bg-brand text-brand-fg transition disabled:bg-surface-interactive disabled:text-white/25"
            >
              <Icon name="send" filled className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {viewer && <ImageViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
