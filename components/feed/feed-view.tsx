"use client";
import { MoreSkeleton } from "@/components/ui/skeleton";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeedItem, FeedScope, Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { feedEvents } from "@/lib/feed/event-tracker";
import { useDocumentFocus } from "@/lib/feed/focus";
import { usePrefetchWindow } from "@/lib/feed/net";
import { useFeed } from "@/lib/feed/use-feed";
import { FeedCard } from "./feed-card";
import { CaughtUp, FeedEmpty, FeedError, FeedSkeleton } from "./feed-states";
import { FeedStories } from "./feed-stories";
import { FeedTopBar } from "./feed-top-bar";
import { PeopleUnit } from "./people-unit";
import { ScrollArrows } from "./scroll-arrows";
import { postHasVideo } from "./post-media";

// Which tab you were on survives leaving the feed and coming back.
let rememberedScope: FeedScope = "for_you";

// Closes out the current post's dwell time once the caught-up page is what's on screen.
function LeaveWhenVisible({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) feedEvents.leave();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}

// `pinned`: a shared post/listing shown first, with the For You feed continuing under it. It lives only on screen:
// it is never written into the feed cache, never changes the remembered position, and is dropped from the list below.
export function FeedView({ pinned = null, pinnedFocus }: { pinned?: Post | null; pinnedFocus?: number }) {
  const { status } = useAuth();
  const authed = status === "authed";
  const [scope, setScopeState] = useState<FeedScope>(() => (pinned ? "for_you" : rememberedScope));
  const setScope = useCallback((s: FeedScope) => {
    rememberedScope = s;
    setScopeState(s);
  }, []);
  const effScope: FeedScope = authed ? scope : "for_you";
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [storyOpen, setStoryOpen] = useState(false);

  const [pinnedLocal, setPinnedLocal] = useState<Partial<Post>>({});
  const [pinnedGone, setPinnedGone] = useState(false);
  const pinnedPost = useMemo<Post | null>(
    () => (pinned && !pinnedGone && effScope === "for_you" ? { ...pinned, ...pinnedLocal } : null),
    [pinned, pinnedLocal, pinnedGone, effScope],
  );
  const usingPinned = pinnedPost !== null;

  const {
    data,
    hasFresh,
    gen,
    storeKey,
    loading,
    reload,
    applyFresh,
    maybeLoadMore,
    getPosition,
    setPosition,
    patchPost,
    removePost,
  } = useFeed({
    enabled: status !== "loading",
    authed,
    scope: effScope,
  });

  const patch = useCallback(
    (id: number, p: Partial<Post>) => {
      if (pinned && id === pinned.id) setPinnedLocal((o) => ({ ...o, ...p }));
      patchPost(id, p);
    },
    [pinned, patchPost],
  );
  const remove = useCallback(
    (id: number) => {
      if (pinned && id === pinned.id) setPinnedGone(true);
      removePost(id);
    },
    [pinned, removePost],
  );

  // Behavioural events are for signed-in users only. (Follow state is wiped by the cache on account change.)
  useEffect(() => {
    feedEvents.setEnabled(authed);
    return () => feedEvents.leave();
  }, [authed]);

  // Active entry: local state while scrolling, the store's remembered position when we (re)mount.
  // With a pinned post the viewer always starts on it, whatever position was remembered.
  const [activeState, setActiveState] = useState({ key: "", gen: -1, index: 0 });
  const active =
    activeState.key === storeKey && (usingPinned || activeState.gen === gen)
      ? activeState.index
      : usingPinned
        ? 0
        : getPosition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const focused = useDocumentFocus();
  const windowFor = usePrefetchWindow(active);

  // Dwell time only counts while the window is actually focused.
  useEffect(() => {
    if (focused) feedEvents.release("focus");
    else feedEvents.hold("focus");
  }, [focused]);

  // Rendered entries: the pinned post, then posts, plus people units minus anyone dismissed.
  const entries = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    if (pinnedPost) out.push({ type: "post", post: pinnedPost } as FeedItem);
    for (const it of data?.items ?? []) {
      if (it.type === "post") {
        if (pinnedPost && it.post.id === pinnedPost.id) continue;
        out.push(it);
      } else {
        const users = it.users.filter((u) => !dismissed.has(`${it.id}:${u.id}`));
        if (users.length > 0) out.push({ ...it, users });
      }
    }
    return out;
  }, [data, dismissed, pinnedPost]);

  const latest = useRef<{ entries: FeedItem[]; sessionId: string | null; offset: number }>({
    entries: [],
    sessionId: null,
    offset: 0,
  });
  useEffect(() => {
    latest.current = { entries, sessionId: data?.sessionId ?? null, offset: usingPinned ? 1 : 0 };
  });
  const seenUnits = useRef(new Set<string>());

  // While we jump back to where the viewer left off, ignore stray activations of other cards.
  const restoreGuard = useRef<number | null>(null);

  const onActivate = useCallback(
    (i: number) => {
      const g = restoreGuard.current;
      if (g !== null) {
        if (i !== g) return;
        restoreGuard.current = null;
      }
      setActiveState({ key: storeKey, gen, index: i });
      const { entries: es, sessionId, offset } = latest.current;
      if (offset === 0) setPosition(i); // a pinned list is offset by one: never store its indexes
      maybeLoadMore(Math.max(0, i - offset));
      const e = es[i];
      if (!e) return;
      if (e.type === "post") {
        feedEvents.show({
          postId: e.post.id,
          isVideo: postHasVideo(e.post),
          sessionId,
          src: e.meta?.src ?? null,
          slot: e.meta?.slot ?? i,
        });
      } else {
        feedEvents.leave();
        if (seenUnits.current.add(e.id)) {
          for (const u of e.users) feedEvents.suggestion("suggestion_impression", u.id, sessionId);
        }
      }
    },
    [storeKey, gen, setPosition, maybeLoadMore],
  );

  // Back on the feed: jump (before paint) to the post the viewer was on. A pinned post always starts at the top.
  const restoredFor = useRef<string | null>(null);
  const hasList = entries.length > 0 && (usingPinned || !!data);
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || !hasList || restoredFor.current === storeKey) return;
    restoredFor.current = storeKey;
    if (usingPinned) {
      sc.scrollTop = 0;
      return;
    }
    const idx = Math.min(getPosition(), entries.length - 1);
    if (idx > 0) {
      restoreGuard.current = idx;
      const el = sc.children[idx] as HTMLElement | undefined;
      if (el) sc.scrollTop = el.offsetTop;
      window.setTimeout(() => {
        restoreGuard.current = null;
      }, 700);
    } else {
      sc.scrollTop = 0;
    }
  }, [hasList, usingPinned, storeKey, entries.length, getPosition]);

  // The list was replaced (refresh / "New posts"): start from the top.
  const seenGen = useRef<{ key: string; gen: number } | null>(null);
  useLayoutEffect(() => {
    const prev = seenGen.current;
    seenGen.current = { key: storeKey, gen };
    if (prev && prev.key === storeKey && prev.gen !== gen) scrollerRef.current?.scrollTo({ top: 0 });
  }, [gen, storeKey]);

  // Auth still resolving: show the skeleton only. No top bar, so a guest "Sign in" can never flash.
  if (status === "loading") {
    return (
      <div className="relative h-dvh">
        <FeedSkeleton />
      </div>
    );
  }

  const topBar = <FeedTopBar authed={authed} scope={effScope} onScope={setScope} />;

  if (!data && !usingPinned) {
    return (
      <div className="relative h-dvh">
        {topBar}
        <FeedSkeleton />
      </div>
    );
  }
  if (data?.error && entries.length === 0) {
    return (
      <div className="relative h-dvh">
        {topBar}
        <FeedError message={data.error} onRetry={reload} />
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="relative h-dvh">
        {topBar}
        <FeedEmpty scope={effScope} />
      </div>
    );
  }

  const sessionId = data?.sessionId ?? null;

  return (
    <div className="relative h-dvh">
      <div
        ref={scrollerRef}
        className={`no-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain transition-opacity duration-200 ${
          loading && data ? "opacity-40" : "opacity-100"
        }`}
      >
        {entries.map((it, i) =>
          it.type === "post" ? (
            <FeedCard
              key={`p${it.post.id}`}
              post={it.post}
              index={i}
              active={i === active && !storyOpen}
              near={windowFor(i).near}
              warm={windowFor(i).warm}
              commentFocus={pinnedPost && it.post.id === pinnedPost.id ? pinnedFocus : undefined}
              onActivate={onActivate}
              patch={patch}
              onRemove={remove}
            />
          ) : (
            <PeopleUnit
              key={`u${it.id}`}
              item={it}
              index={i}
              onActivate={onActivate}
              onOpen={(uid) => feedEvents.suggestion("suggestion_open", uid, sessionId)}
              onFollowed={(uid) => feedEvents.suggestion("suggestion_follow", uid, sessionId)}
              onDismiss={(uid) => {
                feedEvents.suggestion("suggestion_dismiss", uid, sessionId);
                setDismissed((prev) => new Set(prev).add(`${it.id}:${uid}`));
              }}
            />
          ),
        )}
        {data?.caughtUp && (
          <LeaveWhenVisible>
            <CaughtUp actions={data.nextActions} isGuest={!authed} busy={loading} onRefresh={reload} />
          </LeaveWhenVisible>
        )}
        {(!data || data.loadingMore) && <MoreSkeleton />}
        <FeedStories onViewerChange={setStoryOpen} />
      </div>
      {topBar}
      <ScrollArrows scroller={scrollerRef} index={active} count={entries.length} />
      {hasFresh ? (
        <div className="pointer-events-none absolute inset-x-0 top-[76px] z-30 flex justify-center">
          <button
            type="button"
            onClick={applyFresh}
            className="sv-rise pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-black shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            New posts
          </button>
        </div>
      ) : (
        data?.notice && (
          <div className="pointer-events-none absolute inset-x-0 top-[76px] z-30 flex justify-center">
            <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">{data.notice}</span>
          </div>
        )
      )}
    </div>
  );
}
