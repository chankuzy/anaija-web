"use client";
import { ActivitySkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostViewer } from "@/components/discover/post-viewer";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { MULTI_MIN, MultiBadge } from "@/components/ui/multi-badge";
import { useActivity } from "@/lib/activity/activity-context";
import { activityApi, type ActivityDest, type ActivityFilter, type ActivityItem } from "@/lib/api/activity";
import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { onCacheClear } from "@/lib/cache/swr";
import { toggleFollow } from "@/lib/feed/follow-store";
import { timeAgo } from "@/lib/format";
import { usePaged, type Page } from "@/lib/paged/use-paged";
import { StoryViewer } from "@/components/messaging/story-viewer";
import { resolveTarget, type Target } from "@/lib/activity/route";
import { storiesApi, type StoryGroup } from "@/lib/api/stories";

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "follows", label: "Follows" },
];

type Shape = "bare" | "circle" | "square";
// Mirrors the Flutter Activity screen: likes are a bare red heart, other kinds a coloured badge with a white icon.
const GLYPH: Record<string, { icon: IconName | null; color: string; shape: Shape }> = {
  like: { icon: "heart", color: "#E11D48", shape: "bare" },
  story_like: { icon: "heart", color: "#E11D48", shape: "bare" },
  comment: { icon: "message", color: "#2563EB", shape: "circle" },
  reply: { icon: "message", color: "#2563EB", shape: "circle" },
  story_reply: { icon: "message", color: "#2563EB", shape: "circle" },
  message: { icon: "message", color: "#14B8A6", shape: "circle" },
  follow: { icon: "userPlus", color: "#7C3AED", shape: "circle" },
  follow_back: { icon: "userPlus", color: "#7C3AED", shape: "circle" },
  repost: { icon: "repeat", color: "#16A34A", shape: "circle" },
  post_new: { icon: "plus", color: "#7C3AED", shape: "square" },
  inquiry: { icon: "bag", color: "#C026D3", shape: "circle" },
  mention: { icon: null, color: "#2563EB", shape: "circle" },
};
const FALLBACK = { icon: "bell" as IconName, color: "#71717A", shape: "circle" as Shape };

// activity_items timestamps can come back without a zone; they are UTC.
const utc = (s: string) => (/(Z|[+-]\d\d(:?\d\d)?)$/i.test(s) ? s : `${s}Z`);

const isVid = (t: string | null | undefined) => (t ?? "").toLowerCase() === "video";
function coverOf(p: Post): string | null {
  const m = [...p.media].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
  return m?.thumbnail ?? (m && !isVid(m.type) ? m.url : null) ?? p.thumbnail_url ?? null;
}
const isMulti = (p: Post) => p.media.length >= MULTI_MIN && !p.media.some((m) => isVid(m.type));
const toItem = (p: Post): DiscoverItem => ({ id: String(p.id), kind: p.type === "listing" ? "listing" : "post", post: p, src: null, slot: 0 });

function Glyph({ kind }: { kind: string }) {
  const g = GLYPH[kind] ?? FALLBACK;
  if (g.shape === "bare") {
    return (
      <span className="text-like">
        <Icon name={g.icon ?? "heart"} filled className="size-8" />
      </span>
    );
  }
  return (
    <span
      className={`grid size-[30px] place-items-center bg-surface-interactive text-brand ${g.shape === "square" ? "rounded-[9px]" : "rounded-full"}`}
      style={undefined}
    >
      {g.icon ? <Icon name={g.icon} className="size-[18px]" /> : <span className="text-[17px] font-extrabold leading-none">@</span>}
    </span>
  );
}

// Memory-only, wiped on sign-out / account change: activity is personal and never written to disk.
const coverCache = new Map<string, Post[]>();
const unreadByFilter = new Map<ActivityFilter, number>();
onCacheClear(() => {
  coverCache.clear();
  unreadByFilter.clear();
});

// "Liked N of your posts": covers of those posts in a horizontal strip, fetched when the row scrolls into view.
function Covers({ id, count, onOpen }: { id: number; count: number; onOpen: (posts: Post[], index: number) => void }) {
  const key = `${id}:${count}`;
  const ref = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<Post[] | null>(() => coverCache.get(key) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (posts || failed) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting) return;
        io.disconnect();
        activityApi
          .targets(id)
          .then((p) => {
            coverCache.set(key, p);
            setPosts(p);
          })
          .catch(() => setFailed(true));
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, key, posts, failed]);

  if (failed || (posts && posts.length === 0)) return null;
  return (
    <div ref={ref} className="no-scrollbar -mr-4 flex gap-2 overflow-x-auto pr-4">
      {posts
        ? posts.map((p, i) => {
            const src = coverOf(p);
            return (
              <button
                key={p.id}
                type="button"
                aria-label="Open post"
                onClick={() => onOpen(posts, i)}
                className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-card"
              >
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                )}
                {isMulti(p) && <MultiBadge small className="right-1 top-1" />}
              </button>
            );
          })
        : Array.from({ length: Math.min(count, 8) }, (_, i) => <span key={i} className="size-16 shrink-0 animate-pulse rounded-2xl bg-card" />)}
    </div>
  );
}

function Row({
  item,
  onOpen,
  onThumb,
  onActor,
  onFollowBack,
  onDismiss,
  onCovers,
}: {
  item: ActivityItem;
  onOpen: () => void;
  onThumb: () => void;
  onActor: () => void;
  onFollowBack: () => void;
  onDismiss: () => void;
  onCovers: (posts: Post[], index: number) => void;
}) {
  const multi = item.actor_count > 1 && item.actors.length > 1;
  const actor = item.actors[0];
  const unread = !item.is_read;
  const preview = item.preview ? (item.quote ? `“${item.preview}”` : item.preview) : null;
  const listDest = [item.content, item.destination].find((d) => d?.kind === "posts_list" && !!d.item_id) ?? null;
  const coversId = item.thumb_count > 1 && listDest ? (listDest.item_id as number) : null;

  return (
    <div className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-white/4 ${coversId ? "items-start" : "items-center"}`}>
      <button type="button" aria-label="Open" onClick={onOpen} className="absolute inset-0" />
      <span className={`relative flex w-8 shrink-0 items-center justify-center ${coversId ? "h-[52px]" : ""}`}>
        <Glyph kind={item.kind} />
      </span>
      {!multi && actor && (
        <button type="button" onClick={onActor} className="relative shrink-0" aria-label={`Open ${actor.username}`}>
          <Avatar url={actor.avatar} name={actor.name} size={52} />
        </button>
      )}
      <div className="pointer-events-none relative min-w-0 flex-1">
        {multi && (
          <div className="mb-2 flex">
            {item.actors.slice(0, 3).map((a, i) => (
              <span key={a.id} className="rounded-full border-2 border-bg" style={{ marginLeft: i ? -10 : 0 }}>
                <Avatar url={a.avatar} name={a.name} size={26} />
              </span>
            ))}
          </div>
        )}
        <p className={`text-[15px] font-medium leading-[1.3] ${unread ? "text-fg" : "text-fg/80"}`}>{item.title}</p>
        {preview && <p className="mt-1 line-clamp-2 text-secondary leading-[1.35] text-muted">{preview}</p>}
        {item.follow_back !== null && actor && (
          <button
            type="button"
            onClick={onFollowBack}
            className={`pointer-events-auto mt-2 h-[30px] rounded-full px-3 text-micro font-bold ${
              item.follow_back ? "bg-surface-interactive text-fg" : "bg-brand text-brand-fg"
            }`}
          >
            {item.follow_back ? "Following" : "Follow back"}
          </button>
        )}
        <p className="mt-1 flex items-center gap-2 text-[13px] text-muted">
          {timeAgo(utc(item.last_event_at))}
          {unread && <span className="size-[7px] rounded-full bg-brand" />}
        </p>
        {coversId && (
          <div className="pointer-events-auto relative mt-2.5">
            <Covers id={coversId} count={item.thumb_count} onOpen={onCovers} />
          </div>
        )}
      </div>
      {item.kind === "message" ? (
        <span className="relative rounded-full bg-surface-interactive px-3.5 py-2 text-secondary font-bold text-fg">Message</span>
      ) : !coversId && item.thumb ? (
        <button type="button" onClick={onThumb} aria-label="Open content" className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumb} alt="" loading="lazy" className="size-[68px] rounded-2xl object-cover" />
          {item.thumb_count >= MULTI_MIN && <MultiBadge small className="right-1 top-1" />}
        </button>
      ) : null}
      {item.id > 0 && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onDismiss}
          className="absolute right-2 top-1 hidden size-7 place-items-center rounded-full bg-bg/80 text-muted opacity-0 hover:text-fg group-hover:opacity-100 md:grid"
        >
          <Icon name="close" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// Desktop slide-out panel and mobile full-screen sheet (there is no /notifications page).
export function NotificationsView({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const { version, clearUnseen } = useActivity();
  const authed = status === "authed";
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [unreadState, setUnreadState] = useState<{ filter: ActivityFilter; n: number } | null>(null);
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; start: number } | null>(null);
  const [storyView, setStoryView] = useState<{ groups: StoryGroup[]; storyId: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The last known count shows instantly (cached list, no flash of an empty "Mark all read"), the server corrects it.
  const unread = unreadState && unreadState.filter === filter ? unreadState.n : (unreadByFilter.get(filter) ?? 0);
  function setUnread(n: number) {
    unreadByFilter.set(filter, n);
    setUnreadState({ filter, n });
  }

  const push = useCallback(
    (url: string) => {
      onClose();
      router.push(url);
    },
    [onClose, router],
  );

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const load = useCallback(
    async (cursor: string | null, signal?: AbortSignal): Promise<Page<ActivityItem, string>> => {
      const r = await activityApi.list(filter, cursor, signal);
      if (!cursor) {
        unreadByFilter.set(filter, r.unread);
        setUnreadState({ filter, n: r.unread });
        // Opening the panel clears the bell (items that arrive later stay unseen).
        if (r.items[0]) {
          clearUnseen();
          void activityApi.seen(r.items[0].last_event_at).catch(() => {});
        }
      }
      return { items: r.items, cursor: r.cursor, hasMore: r.hasMore };
    },
    [filter, clearUnseen],
  );
  // staleMs 0: every open paints the cached list instantly and quietly re-reads the server (which also clears the
  // bell). persist=false: activity includes message previews, so it stays in memory and never touches disk.
  const list = usePaged<ActivityItem, string>({ id: `activity:${filter}`, enabled: authed, load, staleMs: 0, persist: false });
  const items = list.data?.items ?? [];
  const hasMore = list.data?.hasMore ?? false;
  const loadingMore = list.data?.loadingMore ?? false;
  const loadMore = list.loadMore;

  // Live: the server announced new activity, so re-read the first page.
  const reloadRef = useRef(list.reload);
  useEffect(() => {
    reloadRef.current = list.reload;
  });
  const seenVersion = useRef(version);
  useEffect(() => {
    if (version === seenVersion.current) return;
    seenVersion.current = version;
    reloadRef.current();
  }, [version]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadMore(), {
      root: scrollRef.current,
      rootMargin: "600px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, hasMore, loadingMore, loadMore]);

  function flash(m: string) {
    setToast(m);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  function markRead(it: ActivityItem) {
    if (it.id < 0 || it.is_read) return; // conversation rows clear when the chat is read
    list.patch(it.id, { is_read: true });
    setUnread(Math.max(0, unread - 1));
    void activityApi.read(it.id).catch(() => {});
  }

  async function openStory(id: number) {
    try {
      const groups = await storiesApi.list();
      const own = user ? groups.find((g) => g.author.id === user.id) : undefined;
      if (!own || !own.stories.some((s) => s.id === id)) return flash("This story has expired");
      setStoryView({ groups: [own], storyId: id });
    } catch {
      flash("Couldn't open that story");
    }
  }

  async function run(t: Target): Promise<void> {
    switch (t.type) {
      case "url":
        return push(t.url);
      case "conversation":
        return push(`/messages/${t.id}`);
      case "posts_list":
        try {
          const posts = await activityApi.targets(t.itemId);
          if (posts.length === 0) return flash("Those posts aren't available anymore");
          setViewer({ items: posts.map(toItem), start: 0 });
        } catch {
          flash("Couldn't open that");
        }
        return;
      case "story":
        return openStory(t.storyId);
      case "toast":
        return flash(t.message);
      case "none":
        return;
    }
  }

  function open(it: ActivityItem, d: ActivityDest) {
    markRead(it);
    void run(resolveTarget(it, d, user?.username));
  }

  async function followBack(it: ActivityItem) {
    const a = it.actors[0];
    if (!a || it.follow_back === null) return;
    const r = await toggleFollow(a.id, it.follow_back);
    if (r === null) flash("Unable to update follow");
    else list.patch(it.id, { follow_back: r });
  }

  function dismiss(it: ActivityItem) {
    list.remove(it.id);
    void activityApi.dismiss(it.id).catch(() => {});
  }

  async function markAll() {
    setUnread(0);
    try {
      await activityApi.readAll();
    } finally {
      list.reload();
    }
  }

  let body: React.ReactNode;
  if (status !== "authed" || (list.loading && !list.data)) {
    body = <ActivitySkeleton />;
  } else if (list.data?.error && items.length === 0) {
    body = (
      <div className="py-24 text-center">
        <p className="text-[15px] font-bold text-fg">Couldn&apos;t load activity</p>
        <button type="button" onClick={list.reload} className="mt-4 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg">
          Try again
        </button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="py-24 text-center">
        <p className="text-[15px] font-bold text-fg">No activity yet</p>
        <p className="mt-1 text-secondary text-muted">Likes, comments and follows will show here</p>
      </div>
    );
  } else {
    body = (
      <>
        {items.map((it) => (
          <Row
            key={it.id}
            item={it}
            onOpen={() => open(it, it.destination)}
            onThumb={() => open(it, it.content ?? it.destination)}
            onActor={() => {
              markRead(it);
              const a = it.actors[0];
              if (a?.username) push(`/u/${a.username}`);
              else void run(resolveTarget(it, it.destination, user?.username));
            }}
            onFollowBack={() => void followBack(it)}
            onDismiss={() => dismiss(it)}
            onCovers={(posts, index) => {
              markRead(it);
              setViewer({ items: posts.map(toItem), start: index });
            }}
          />
        ))}
        <div ref={sentinel} className="h-px" />
        {loadingMore && <ActivitySkeleton count={2} />}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-3 pb-2" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-1 py-1.5">
          <button type="button" aria-label="Back" onClick={onClose} className="grid size-10 place-items-center rounded-full text-fg hover:bg-white/8 md:hidden">
            <Icon name="back" className="size-6" />
          </button>
          <h1 className="flex-1 px-1 text-[24px] font-extrabold tracking-tight text-fg">Activity</h1>
          {unread > 0 && (
            <button type="button" onClick={() => void markAll()} className="h-9 rounded-full px-3 text-secondary font-semibold text-muted hover:bg-white/8 hover:text-fg">
              Mark all read
            </button>
          )}
          <Link
            href="/settings/notifications"
            aria-label="Notification settings"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full text-white/70 hover:bg-white/8 hover:text-white"
          >
            <Icon name="settings" className="size-6" />
          </Link>
        </div>
        <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-9 shrink-0 rounded-full px-4 text-secondary font-bold ${
                f.id === filter ? "bg-brand text-brand-fg" : "bg-surface-interactive text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Silent background reconcile: a hairline, never a spinner over the list. */}
        <div className={`mt-1.5 h-[2px] overflow-hidden rounded transition-opacity duration-300 ${list.refreshing ? "opacity-100" : "opacity-0"}`}>
          <div className="h-full w-1/3 animate-pulse rounded bg-white/50" />
        </div>
      </header>

      <div ref={scrollRef} data-notif-scroll className="no-scrollbar min-h-0 flex-1 overscroll-contain overflow-y-auto pb-6">
        {body}
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center">
          <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white">{toast}</span>
        </div>
      )}
      {viewer && <PostViewer items={viewer.items} startIndex={viewer.start} onClose={() => setViewer(null)} onPatch={() => {}} onRemove={() => {}} />}
      {storyView && <StoryViewer groups={storyView.groups} start={0} startStoryId={storyView.storyId} myId={user?.id} onClose={() => setStoryView(null)} />}
    </div>
  );
}
