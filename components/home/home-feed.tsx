"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MoreSkeleton } from "@/components/ui/skeleton";
import type { FeedItem, PeopleItem, PostItem } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { onCacheClear } from "@/lib/cache/swr";
import { contentKind, hasRenderableContent } from "@/lib/feed/content";
import { feedEvents } from "@/lib/feed/event-tracker";
import { useDocumentFocus } from "@/lib/feed/focus";
import { useFeed } from "@/lib/feed/use-feed";
import { HomeHeader } from "./home-header";
import { HomePost } from "./home-post";
import { HomeStories } from "./home-stories";
import { PeopleStrip } from "./people-strip";
import { HomeCaughtUp, HomeEmpty, HomeMessage, HomeSkeleton, QUIET } from "./home-states";

// Survives leaving Home (module scope), like the immersive feed's remembered position.
const scrolls = new Map<string, number>();
onCacheClear(() => scrolls.clear());

const MIN_CURRENT = 0.4; // share of a post's media on screen before it counts as "being looked at"
const MIN_PLAYING = 0.6; // ... and before a reel may play / images may slide

// Home: the mixed feed. Same data store as Immersive (use-feed), so a post has one identity, one engagement state
// and one recommendation session. Presentation is chosen per post by lib/feed/content + components/home/renderers.
export function HomeFeed() {
  const { status } = useAuth();
  const authed = status === "authed";
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const { data, hasFresh, gen, storeKey, loading, reload, applyFresh, maybeLoadMore, patchPost, removePost } = useFeed({
    enabled: status !== "loading",
    authed,
    scope: "for_you",
  });

  const entries = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    for (const it of data?.items ?? []) {
      if (it.type === "post") {
        if (hasRenderableContent(it.post)) out.push(it);
      } else {
        const users = it.users.filter((u) => !dismissed.has(`${it.id}:${u.id}`));
        if (users.length > 0) out.push({ ...it, users });
      }
    }
    return out;
  }, [data, dismissed]);

  // ── which post is "current": the one with the most media on screen ──────────────────────────────
  const ratios = useRef(new Map<number, number>());
  const [cur, setCur] = useState<{ id: number | null; strong: boolean }>({ id: null, strong: false });
  const onVisible = useCallback((id: number, ratio: number) => {
    if (ratio <= 0) ratios.current.delete(id);
    else ratios.current.set(id, ratio);
    let best: number | null = null;
    let bestR = 0;
    for (const [k, r] of ratios.current) {
      if (r > bestR) {
        best = k;
        bestR = r;
      }
    }
    const next = { id: bestR >= MIN_CURRENT ? best : null, strong: bestR >= MIN_PLAYING };
    setCur((p) => (p.id === next.id && p.strong === next.strong ? p : next));
  }, []);

  // ── behavioural events (signed-in only), same tracker and contract as Immersive ─────────────────
  const latest = useRef<{ posts: Map<number, PostItem>; sessionId: string | null }>({ posts: new Map(), sessionId: null });
  useEffect(() => {
    const posts = new Map<number, PostItem>();
    for (const e of entries) if (e.type === "post") posts.set(e.post.id, e);
    latest.current = { posts, sessionId: data?.sessionId ?? null };
  });
  useEffect(() => {
    feedEvents.setEnabled(authed);
    return () => feedEvents.leave();
  }, [authed]);
  const focused = useDocumentFocus();
  useEffect(() => {
    if (focused) feedEvents.release("focus");
    else feedEvents.hold("focus");
  }, [focused]);
  useEffect(() => {
    if (cur.id === null) {
      feedEvents.leave();
      return;
    }
    const e = latest.current.posts.get(cur.id);
    if (!e) return;
    feedEvents.show({
      postId: e.post.id,
      isVideo: contentKind(e.post) === "reel",
      sessionId: latest.current.sessionId,
      src: e.meta?.src ?? null,
      slot: e.meta?.slot ?? 0,
    });
  }, [cur.id]);

  const seenUnits = useRef(new Set<string>());
  const onUnitSeen = useCallback((item: PeopleItem) => {
    feedEvents.leave();
    if (seenUnits.current.add(item.id)) {
      for (const u of item.users) feedEvents.suggestion("suggestion_impression", u.id, latest.current.sessionId);
    }
  }, []);

  // ── pagination: a sentinel near the end asks the store for the next page ────────────────────────
  const sentinel = useRef<HTMLDivElement>(null);
  const total = data?.items.length ?? 0;
  const loadingMore = data?.loadingMore ?? false;
  const caughtUp = data?.caughtUp ?? false;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || total === 0) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) maybeLoadMore(total - 1);
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [total, loadingMore, caughtUp, maybeLoadMore]);

  // ── scroll position: saved while scrolling, restored (before paint) when Home comes back ────────
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scrolls.set(storeKey, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [storeKey]);

  const restoredFor = useRef<string | null>(null);
  const hasList = entries.length > 0;
  useLayoutEffect(() => {
    if (!hasList || restoredFor.current === storeKey) return;
    restoredFor.current = storeKey;
    const y = scrolls.get(storeKey) ?? 0;
    if (y <= 0) return;
    window.scrollTo(0, y);
    // The router may reset scroll right after mount; re-assert for two frames.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      window.scrollTo(0, y);
      r2 = requestAnimationFrame(() => window.scrollTo(0, y));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [hasList, storeKey]);

  // The list was replaced (refresh / "New posts"): start from the top.
  const seenGen = useRef<{ key: string; gen: number } | null>(null);
  useLayoutEffect(() => {
    const prev = seenGen.current;
    seenGen.current = { key: storeKey, gen };
    if (prev && prev.key === storeKey && prev.gen !== gen) window.scrollTo({ top: 0 });
  }, [gen, storeKey]);

  // ── render ──────────────────────────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-[630px] pt-6">
        <HomeSkeleton />
      </div>
    );
  }

  const wrap = (children: ReactNode) => (
    <div className="mx-auto w-full max-w-[630px]" style={{ paddingBottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 32px)" }}>
      <HomeHeader authed={authed} />
      {children}
    </div>
  );

  if (!data) return wrap(<HomeSkeleton />);
  if (data.error && entries.length === 0) {
    return wrap(
      <HomeMessage
        title="Couldn't load your feed"
        sub={data.error}
        action={
          <button type="button" onClick={reload} className={QUIET}>
            Try again
          </button>
        }
      />,
    );
  }
  if (entries.length === 0) return wrap(<HomeEmpty scope="for_you" />);

  const pillPos = { top: "calc(env(safe-area-inset-top) + 12px)" };
  return wrap(
    <>
      <HomeStories />
      {hasFresh ? (
        <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center" style={pillPos}>
          <button
            type="button"
            onClick={applyFresh}
            className="sv-rise pointer-events-auto inline-flex h-10 items-center gap-1.5 rounded-pill bg-fg px-4 text-xs font-bold text-bg shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition active:scale-95 motion-reduce:active:scale-100"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            New posts
          </button>
        </div>
      ) : (
        data.notice && (
          <div role="status" className="pointer-events-none fixed inset-x-0 z-30 flex justify-center" style={pillPos}>
            <span className="rounded-pill bg-black/75 px-3.5 py-2 text-xs font-semibold text-white">{data.notice}</span>
          </div>
        )
      )}

      <div className={`transition-opacity duration-200 motion-reduce:transition-none ${loading ? "opacity-60" : "opacity-100"}`}>
        {entries.map((it, i) =>
          it.type === "post" ? (
            <HomePost
              key={`p${it.post.id}`}
              post={it.post}
              index={i}
              active={cur.strong && cur.id === it.post.id}
              onVisible={onVisible}
              patch={patchPost}
              onRemove={removePost}
            />
          ) : (
            <PeopleStrip
              key={`u${it.id}`}
              item={it}
              onSeen={onUnitSeen}
              onOpen={(uid) => feedEvents.suggestion("suggestion_open", uid, data.sessionId)}
              onFollowed={(uid) => feedEvents.suggestion("suggestion_follow", uid, data.sessionId)}
              onDismiss={(uid) => {
                feedEvents.suggestion("suggestion_dismiss", uid, data.sessionId);
                setDismissed((prev) => new Set(prev).add(`${it.id}:${uid}`));
              }}
            />
          ),
        )}
      </div>

      {data.caughtUp ? (
        <HomeCaughtUp actions={data.nextActions} isGuest={!authed} busy={loading} onRefresh={reload} />
      ) : (
        <div ref={sentinel} aria-hidden className="h-px" />
      )}
      {data.loadingMore && <MoreSkeleton />}
    </>,
  );
}
