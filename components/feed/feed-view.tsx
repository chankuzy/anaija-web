"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeedItem, FeedScope } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { feedEvents } from "@/lib/feed/event-tracker";
import { resetFollows } from "@/lib/feed/follow-store";
import { useFeed } from "@/lib/feed/use-feed";
import { FeedCard } from "./feed-card";
import { CaughtUp, FeedEmpty, FeedError, FeedSkeleton } from "./feed-states";
import { FeedTopBar } from "./feed-top-bar";
import { PeopleUnit } from "./people-unit";
import { postHasVideo } from "./post-media";

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

export function FeedView() {
  const { status } = useAuth();
  const authed = status === "authed";
  const [scope, setScope] = useState<FeedScope>("for_you");
  const effScope: FeedScope = authed ? scope : "for_you";
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  const { data, loading, reload, maybeLoadMore, patchPost, removePost } = useFeed({
    enabled: status !== "loading",
    authed,
    scope: effScope,
  });

  // Behavioural events are for signed-in users only; follow state belongs to one account.
  useEffect(() => {
    resetFollows();
    feedEvents.setEnabled(authed);
    return () => feedEvents.leave();
  }, [authed]);

  const dataKey = data?.key ?? "";
  const [activeState, setActiveState] = useState({ key: "", index: 0 });
  const active = activeState.key === dataKey ? activeState.index : 0;
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Rendered entries: posts, plus people units minus anyone dismissed (a unit with nobody left is dropped).
  const entries = useMemo<FeedItem[]>(() => {
    if (!data) return [];
    const out: FeedItem[] = [];
    for (const it of data.items) {
      if (it.type === "post") out.push(it);
      else {
        const users = it.users.filter((u) => !dismissed.has(`${it.id}:${u.id}`));
        if (users.length > 0) out.push({ ...it, users });
      }
    }
    return out;
  }, [data, dismissed]);

  const latest = useRef<{ entries: FeedItem[]; sessionId: string | null }>({ entries: [], sessionId: null });
  useEffect(() => {
    latest.current = { entries, sessionId: data?.sessionId ?? null };
  });
  const seenUnits = useRef(new Set<string>());

  const onActivate = useCallback(
    (i: number) => {
      setActiveState({ key: dataKey, index: i });
      maybeLoadMore(i);
      const { entries: es, sessionId } = latest.current;
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
    [dataKey, maybeLoadMore],
  );

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [dataKey]);

  const topBar = <FeedTopBar authed={authed} scope={effScope} onScope={setScope} />;

  if (!data) {
    return (
      <div className="relative h-dvh">
        {topBar}
        <FeedSkeleton />
      </div>
    );
  }
  if (data.error && entries.length === 0) {
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

  return (
    <div className="relative h-dvh">
      <div
        ref={scrollerRef}
        className={`no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain transition-opacity duration-200 ${
          loading ? "opacity-40" : "opacity-100"
        }`}
      >
        {entries.map((it, i) =>
          it.type === "post" ? (
            <FeedCard
              key={`p${it.post.id}`}
              post={it.post}
              index={i}
              active={i === active}
              near={Math.abs(i - active) <= 2}
              onActivate={onActivate}
              patch={patchPost}
              onRemove={removePost}
            />
          ) : (
            <PeopleUnit
              key={`u${it.id}`}
              item={it}
              index={i}
              onActivate={onActivate}
              onOpen={(uid) => feedEvents.suggestion("suggestion_open", uid, data.sessionId)}
              onFollowed={(uid) => feedEvents.suggestion("suggestion_follow", uid, data.sessionId)}
              onDismiss={(uid) => {
                feedEvents.suggestion("suggestion_dismiss", uid, data.sessionId);
                setDismissed((prev) => new Set(prev).add(`${it.id}:${uid}`));
              }}
            />
          ),
        )}
        {data.caughtUp && (
          <LeaveWhenVisible>
            <CaughtUp actions={data.nextActions} isGuest={!authed} busy={loading} onRefresh={reload} />
          </LeaveWhenVisible>
        )}
        {data.loadingMore && <div className="grid h-16 place-items-center text-sm text-muted">Loading…</div>}
      </div>
      {topBar}
      {data.notice && (
        <div className="pointer-events-none absolute inset-x-0 top-[76px] z-30 flex justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">{data.notice}</span>
        </div>
      )}
    </div>
  );
}
