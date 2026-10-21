"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostViewer } from "@/components/discover/post-viewer";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { activityApi, type ActivityDest, type ActivityFilter, type ActivityItem } from "@/lib/api/activity";
import type { DiscoverItem } from "@/lib/api/discover";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow } from "@/lib/feed/follow-store";
import { timeAgo } from "@/lib/format";
import { usePaged, type Page } from "@/lib/paged/use-paged";

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "follows", label: "Follows" },
];

// Same glyph/colour table as notifications_screen.dart. null icon renders "@".
const GLYPH: Record<string, [IconName | null, string]> = {
  like: ["heart", "#E11D48"],
  story_like: ["heart", "#E11D48"],
  comment: ["message", "#2563EB"],
  reply: ["message", "#2563EB"],
  story_reply: ["message", "#2563EB"],
  message: ["message", "#14B8A6"],
  follow: ["userPlus", "#7C3AED"],
  follow_back: ["userPlus", "#7C3AED"],
  repost: ["repeat", "#16A34A"],
  post_new: ["plus", "#7C3AED"],
  inquiry: ["bag", "#C026D3"],
  mention: [null, "#2563EB"],
};

// activity_items timestamps can come back without a zone; they are UTC.
const utc = (s: string) => (/(Z|[+-]\d\d(:?\d\d)?)$/i.test(s) ? s : `${s}Z`);

function Glyph({ kind }: { kind: string }) {
  const [icon, color] = GLYPH[kind] ?? (["bell", "#71717A"] as [IconName, string]);
  return (
    <span className="grid size-[34px] shrink-0 place-items-center" style={{ color }}>
      {icon ? <Icon name={icon} filled className="size-8" /> : <span className="text-[30px] font-extrabold leading-none">@</span>}
    </span>
  );
}

function Row({
  item,
  onOpen,
  onThumb,
  onActor,
  onFollowBack,
  onDismiss,
}: {
  item: ActivityItem;
  onOpen: () => void;
  onThumb: () => void;
  onActor: () => void;
  onFollowBack: () => void;
  onDismiss: () => void;
}) {
  const multi = item.actor_count > 1 && item.actors.length > 1;
  const actor = item.actors[0];
  const unread = !item.is_read;
  const preview = item.preview ? (item.quote ? `“${item.preview}”` : item.preview) : null;

  return (
    <div className={`group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-card/60 ${unread ? "bg-card/30" : ""}`}>
      <button type="button" aria-label="Open" onClick={onOpen} className="absolute inset-0" />
      <Glyph kind={item.kind} />
      {!multi && actor && (
        <button type="button" onClick={onActor} className="relative shrink-0" aria-label={`Open ${actor.username}`}>
          <Avatar url={actor.avatar} name={actor.name} size={54} />
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
        <p className={`text-[15px] font-bold leading-[1.3] ${unread ? "text-fg" : "text-fg/80"}`}>{item.title}</p>
        {preview && <p className="mt-1 line-clamp-2 text-secondary leading-[1.35] text-muted">{preview}</p>}
        {item.follow_back !== null && actor && (
          <button
            type="button"
            onClick={onFollowBack}
            className={`pointer-events-auto mt-2 h-[30px] rounded-full px-3 text-micro font-bold ${
              item.follow_back ? "border border-white/50 text-fg" : "bg-white text-black"
            }`}
          >
            {item.follow_back ? "Following" : "Follow back"}
          </button>
        )}
        <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          {timeAgo(utc(item.last_event_at))}
          {unread && <span className="size-[7px] rounded-full bg-accent" />}
        </p>
      </div>
      {item.kind === "message" ? (
        <span className="relative rounded-full bg-white/8 px-3.5 py-2 text-secondary font-bold text-fg">Message</span>
      ) : item.thumb ? (
        <button type="button" onClick={onThumb} aria-label="Open content" className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumb} alt="" loading="lazy" className="size-[62px] rounded-2xl border border-line object-cover" />
          {item.thumb_count > 1 && <Icon name="share" className="absolute right-1.5 top-1.5 size-3.5 text-white icon-shadow" />}
        </button>
      ) : null}
      {item.id > 0 && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onDismiss}
          className="relative hidden size-8 shrink-0 place-items-center rounded-full text-muted opacity-0 hover:bg-white/8 hover:text-fg group-hover:opacity-100 md:grid"
        >
          <Icon name="close" className="size-4" />
        </button>
      )}
    </div>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const { status, user } = useAuth();
  const authed = status === "authed";
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [unread, setUnread] = useState(0);
  const [viewer, setViewer] = useState<{ items: DiscoverItem[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);
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
        setUnread(r.unread);
        // Opening the screen clears the bell (items that arrive later stay unseen).
        if (r.items[0]) void activityApi.seen(r.items[0].last_event_at).catch(() => {});
      }
      return { items: r.items, cursor: r.cursor, hasMore: r.hasMore };
    },
    [filter],
  );
  const list = usePaged<ActivityItem, string>({ id: `activity:${filter}`, enabled: authed, load });
  const items = list.data?.items ?? [];
  const hasMore = list.data?.hasMore ?? false;
  const loadingMore = list.data?.loadingMore ?? false;
  const loadMore = list.loadMore;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadMore(), { rootMargin: "600px 0px" });
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
    setUnread((n) => Math.max(0, n - 1));
    void activityApi.read(it.id).catch(() => {});
  }

  async function go(d: ActivityDest) {
    switch (d.kind) {
      case "post":
      case "comment": // TODO: highlight the comment (needs a ?comment= param on /p/[id])
        if (d.post_id) return router.push(`/p/${d.post_id}`);
        break;
      case "listing":
        if (d.post_id) return router.push(`/listing/${d.post_id}`);
        break;
      case "profile":
        if (d.username) return router.push(`/u/${d.username}`);
        break;
      case "followers":
        if (user?.username) return router.push(`/u/${user.username}/followers`);
        break;
      case "conversation":
        if (d.conversation_id) return router.push(`/messages/${d.conversation_id}`);
        break;
      case "chats":
        return router.push("/messages");
      case "posts_list":
        if (d.item_id) {
          try {
            const posts = await activityApi.targets(d.item_id);
            if (posts.length === 0) return flash("Those posts aren't available anymore");
            setViewer({
              items: posts.map((p) => ({ id: String(p.id), kind: p.type === "listing" ? "listing" : "post", post: p, src: null, slot: 0 })),
            });
          } catch {
            flash("Couldn't open that");
          }
          return;
        }
        break;
      case "story":
      case "story_summary":
        return flash("Stories aren't on web yet");
      case "none":
        return;
    }
    flash("Can't open this on web yet");
  }

  function open(it: ActivityItem, d: ActivityDest) {
    markRead(it);
    void go(d);
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
    body = <p className="py-24 text-center text-sm text-muted">Loading…</p>;
  } else if (list.data?.error && items.length === 0) {
    body = (
      <div className="py-24 text-center">
        <p className="text-[15px] font-bold text-fg">Couldn&apos;t load activity</p>
        <button type="button" onClick={list.reload} className="mt-4 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black">
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
        <div className="divide-y divide-line/60">
          {items.map((it) => (
            <Row
              key={it.id}
              item={it}
              onOpen={() => open(it, it.destination)}
              onThumb={() => open(it, it.content ?? it.destination)}
              onActor={() => {
                markRead(it);
                const a = it.actors[0];
                if (a?.username) router.push(`/u/${a.username}`);
                else void go(it.destination);
              }}
              onFollowBack={() => void followBack(it)}
              onDismiss={() => dismiss(it)}
            />
          ))}
        </div>
        <div ref={sentinel} className="h-px" />
        {loadingMore && <p className="py-4 text-center text-sm text-muted">Loading…</p>}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] pb-8">
      <header className="sticky top-0 z-20 bg-bg px-4 pb-2" style={{ paddingTop: "calc(10px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 py-1.5">
          <Link href="/" aria-label="Back" className="grid size-10 place-items-center rounded-full text-fg md:hidden relative hit-area">
            <Icon name="back" className="size-5" />
          </Link>
          <h1 className="flex-1 text-[22px] font-bold tracking-tight text-fg">Activity</h1>
          {unread > 0 && (
            <button type="button" onClick={() => void markAll()} className="h-9 rounded-full px-3 text-secondary font-semibold text-muted hover:bg-card hover:text-fg">
              Mark all read
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-9 shrink-0 rounded-full px-4 text-secondary font-semibold ${
                f.id === filter ? "bg-white text-black" : "border border-line bg-card text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {body}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white">{toast}</span>
        </div>
      )}
      {viewer && <PostViewer items={viewer.items} startIndex={0} onClose={() => setViewer(null)} onPatch={() => {}} onRemove={() => {}} />}
    </div>
  );
}
