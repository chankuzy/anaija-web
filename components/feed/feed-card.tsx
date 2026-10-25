"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { postsApi } from "@/lib/api/posts";
import { socialApi } from "@/lib/api/social";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";
import { useShare } from "@/lib/share/share-context";
import { pickIx, setIx, useIx, withIx } from "@/lib/feed/interactions";
import { Icon } from "@/components/ui/icon";
import { ActionRail } from "./action-rail";
import { CommentsSheet } from "./comments-sheet";
import { OptionsSheet } from "./options-sheet";
import { PostInfo } from "./post-info";
import { PostMedia, postHasVideo } from "./post-media";
import type { Warm } from "@/lib/feed/net";

const NAV_LIFT = "env(safe-area-inset-bottom)";

export function FeedCard({
  post: rawPost,
  index,
  active,
  near,
  warm,
  commentFocus,
  onActivate,
  patch: patchProp,
  onRemove,
}: {
  post: Post;
  index: number;
  active: boolean;
  near: boolean;
  warm?: Warm;
  commentFocus?: number;
  onActivate: (i: number) => void;
  patch: (id: number, p: Partial<Post>) => void;
  onRemove: (id: number) => void;
}) {
  const router = useRouter();
  // What you did to this post overrides any stale cached copy, and every change is remembered.
  const ix = useIx(rawPost.id);
  const post = withIx(rawPost, ix);
  const patch = (id: number, p: Partial<Post>) => {
    patchProp(id, p);
    const k = pickIx(p);
    if (k) setIx(id, k);
  };
  const openShare = useShare();
  const shareCount = useRef(post.shares_count);
  const { status, user } = useAuth();
  const sectionRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(commentFocus !== undefined);
  const busyLike = useRef(false);
  const busyBookmark = useRef(false);
  const toastTimer = useRef<number | null>(null);

  const open = expanded && active;
  const hasVideo = postHasVideo(post);
  const hasAudio = !hasVideo && !!post.audio?.enabled && !!post.audio.url;
  const isOwn = status === "authed" && !!post.author && user?.id === post.author.id;
  const following = useIsFollowing(post.author?.id, post.author?.is_following ?? false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onActivate(index);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index, onActivate]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function requireAuth(): boolean {
    if (status === "authed") return true;
    router.push(loginHref());
    return false;
  }

  function onAuthFailure(e: unknown) {
    if (e instanceof ApiError && e.status === 401) router.push(loginHref());
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }

  async function applyLike(target: boolean) {
    if (!requireAuth() || busyLike.current || post.is_liked === target) return;
    busyLike.current = true;
    const prev = { is_liked: post.is_liked, likes_count: post.likes_count };
    patch(post.id, { is_liked: target, likes_count: Math.max(0, post.likes_count + (target ? 1 : -1)) });
    try {
      let r = await postsApi.toggleLike(post.id);
      // The server toggles: if our view was stale it landed on the opposite of what was asked, so flip back once.
      if (r.liked !== target) r = await postsApi.toggleLike(post.id);
      patch(post.id, {
        is_liked: r.liked,
        ...(typeof r.likes_count === "number" ? { likes_count: r.likes_count } : {}),
      });
    } catch (e) {
      patch(post.id, prev);
      onAuthFailure(e);
    } finally {
      busyLike.current = false;
    }
  }

  async function toggleBookmark() {
    if (!requireAuth() || busyBookmark.current) return;
    busyBookmark.current = true;
    const prev = { is_bookmarked: post.is_bookmarked, bookmarks_count: post.bookmarks_count };
    const next = !post.is_bookmarked;
    patch(post.id, { is_bookmarked: next, bookmarks_count: Math.max(0, post.bookmarks_count + (next ? 1 : -1)) });
    try {
      let r = await postsApi.toggleBookmark(post.id);
      if (r.bookmarked !== next) r = await postsApi.toggleBookmark(post.id);
      patch(post.id, {
        is_bookmarked: r.bookmarked,
        ...(typeof r.bookmarks_count === "number" ? { bookmarks_count: r.bookmarks_count } : {}),
      });
    } catch (e) {
      patch(post.id, prev);
      onAuthFailure(e);
    } finally {
      busyBookmark.current = false;
    }
  }

  async function follow(): Promise<boolean | null> {
    const a = post.author;
    if (!a || !requireAuth()) return null;
    const r = await toggleFollow(a.id, following);
    if (r === null) showToast("Unable to update follow");
    return r;
  }

  // Opens the share sheet (people, more, story). The count moves optimistically per person sent, then snaps to
  // the server's number (it never counts your own post and dedupes per user).
  function share() {
    shareCount.current = post.shares_count;
    openShare(post, (delta, serverCount) => {
      shareCount.current = serverCount ?? Math.max(0, shareCount.current + delta);
      patch(post.id, { shares_count: shareCount.current });
    }, (p) => patch(post.id, p));
  }

  function notInterested() {
    if (!requireAuth()) return;
    void socialApi.feedback(post.id, "not_interested").catch(() => {});
    setOptionsOpen(false);
    onRemove(post.id);
  }

  async function deletePost() {
    try {
      await socialApi.deletePost(post.id);
      onRemove(post.id);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Couldn't delete");
    }
  }

  function openComments() {
    if (!post.allow_comments) {
      showToast("Comments are turned off for this post");
      return;
    }
    if (!requireAuth()) return;
    setCommentsOpen(true);
  }

  function onDoubleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button,a,input")) return;
    setBurst(true);
    void applyLike(true);
  }

  const rail = (side: boolean) => (
    <ActionRail
      post={post}
      side={side}
      hasMute={hasVideo || hasAudio}
      onLike={() => void applyLike(!post.is_liked)}
      onComment={openComments}
      onBookmark={() => void toggleBookmark()}
      onShare={() => void share()}
      onOptions={() => setOptionsOpen(true)}
    />
  );

  return (
    <>
      <section
        ref={sectionRef}
        className="relative flex h-dvh snap-start snap-always items-center justify-center"
      >
        <div className="feed-col relative flex h-full items-center md:h-[calc(100dvh-24px)]">
        <article className="feed-card relative overflow-hidden bg-black" onDoubleClick={onDoubleClick}>
          <PostMedia post={post} active={active} near={near} warm={warm} paused={open || optionsOpen || commentsOpen} />

          <div className="fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-80 xl:hidden" />

          {burst && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="heart-burst" onAnimationEnd={() => setBurst(false)}>
                <Icon name="heart" filled className="icon-shadow size-24 text-like" />
              </div>
            </div>
          )}

          {/* Dims the page while the caption is open; tap to close. */}
          <button
            type="button"
            aria-label="Close caption"
            tabIndex={open ? 0 : -1}
            onClick={() => setExpanded(false)}
            className={`absolute inset-0 bg-black/60 transition-opacity duration-200 xl:hidden ${
              open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />

          <div
            className={`absolute right-3 transition-opacity duration-200 md:hidden ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
            style={{ bottom: `calc(24px + var(--nav-h) + ${NAV_LIFT})` }}
          >
            {rail(false)}
          </div>

          <div
            className={`absolute left-4 transition-[right] duration-200 xl:hidden ${open ? "right-4" : "right-[76px] md:right-4"}`}
            style={{ bottom: `calc(20px + var(--nav-h) + ${NAV_LIFT})` }}
          >
            <PostInfo
              post={post}
              expanded={open}
              onExpandedChange={setExpanded}
              isOwn={isOwn}
              following={following}
              onFollow={follow}
            />
          </div>

          {toast && (
            <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
              {toast}
            </div>
          )}
        </article>
        <div className="absolute bottom-9 right-full mr-5 hidden w-[280px] xl:block">
          <PostInfo
            post={post}
            expanded={open}
            onExpandedChange={setExpanded}
            isOwn={isOwn}
            following={following}
            onFollow={follow}
          />
        </div>
        <div className="absolute bottom-9 left-full ml-3 hidden md:block">{rail(true)}</div>
        </div>
      </section>

      {commentsOpen && (
        <CommentsSheet
          postId={post.id}
          focusId={commentFocus}
          initialCount={post.comments_count}
          onCountChange={(n) => patch(post.id, { comments_count: n })}
          onClose={() => setCommentsOpen(false)}
        />
      )}

      {optionsOpen && (
        <OptionsSheet
          post={post}
          isOwn={isOwn}
          following={following}
          onClose={() => setOptionsOpen(false)}
          onFollow={follow}
          onNotInterested={notInterested}
          onDelete={deletePost}
        />
      )}
    </>
  );
}
