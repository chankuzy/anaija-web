"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { postsApi } from "@/lib/api/posts";
import { socialApi } from "@/lib/api/social";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";
import { Icon } from "@/components/ui/icon";
import { ActionRail } from "./action-rail";
import { CommentsSheet } from "./comments-sheet";
import { OptionsSheet } from "./options-sheet";
import { PostInfo } from "./post-info";
import { PostMedia, postHasVideo } from "./post-media";

const NAV_LIFT = "env(safe-area-inset-bottom)";

export function FeedCard({
  post,
  index,
  active,
  near,
  onActivate,
  patch,
  onRemove,
}: {
  post: Post;
  index: number;
  active: boolean;
  near: boolean;
  onActivate: (i: number) => void;
  patch: (id: number, p: Partial<Post>) => void;
  onRemove: (id: number) => void;
}) {
  const router = useRouter();
  const { status, user } = useAuth();
  const sectionRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const busyLike = useRef(false);
  const busyBookmark = useRef(false);
  const busyRepost = useRef(false);
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
    router.push("/login");
    return false;
  }

  function onAuthFailure(e: unknown) {
    if (e instanceof ApiError && e.status === 401) router.push("/login");
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
      const r = await postsApi.toggleLike(post.id);
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
      const r = await postsApi.toggleBookmark(post.id);
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

  async function toggleRepost() {
    if (!requireAuth() || busyRepost.current) return;
    busyRepost.current = true;
    const prev = { is_reposted: post.is_reposted, reposts_count: post.reposts_count };
    const next = !post.is_reposted;
    patch(post.id, { is_reposted: next, reposts_count: Math.max(0, post.reposts_count + (next ? 1 : -1)) });
    try {
      const r = await socialApi.toggleRepost(post.id);
      patch(post.id, {
        is_reposted: r.reposted ?? next,
        ...(typeof r.reposts_count === "number" ? { reposts_count: r.reposts_count } : {}),
      });
    } catch (e) {
      patch(post.id, prev);
      if (e instanceof ApiError && e.status !== 401) showToast(e.message);
      onAuthFailure(e);
    } finally {
      busyRepost.current = false;
    }
  }

  async function follow(): Promise<boolean | null> {
    const a = post.author;
    if (!a || !requireAuth()) return null;
    const r = await toggleFollow(a.id, following);
    if (r === null) showToast("Unable to update follow");
    return r;
  }

  // Web counts a share when the link is actually shared or copied (Flutter counts on send-to-person,
  // which needs messaging). The server never counts your own post and dedupes per user.
  async function share() {
    const url = `${window.location.origin}/p/${post.id}`;
    let done = false;
    try {
      if (navigator.share) {
        await navigator.share({ url, text: post.caption ?? undefined });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
      }
      done = true;
    } catch {
      /* user cancelled, or clipboard unavailable */
    }
    if (done && status === "authed" && !isOwn) {
      try {
        const r = await socialApi.share(post.id);
        patch(post.id, { shares_count: r.shares_count });
      } catch {
        /* the link was still shared */
      }
    }
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

  return (
    <>
      <section
        ref={sectionRef}
        className="relative flex h-dvh snap-start snap-always items-center justify-center"
      >
        <article className="feed-card relative overflow-hidden bg-black" onDoubleClick={onDoubleClick}>
          <PostMedia post={post} active={active} near={near} paused={open || optionsOpen || commentsOpen} />

          <div className="fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-80" />

          {burst && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="heart-burst" onAnimationEnd={() => setBurst(false)}>
                <Icon name="heart" filled className="icon-shadow size-24 text-danger" />
              </div>
            </div>
          )}

          {/* Dims the page while the caption is open; tap to close. */}
          <button
            type="button"
            aria-label="Close caption"
            tabIndex={open ? 0 : -1}
            onClick={() => setExpanded(false)}
            className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
              open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />

          <div
            className={`absolute right-3 transition-opacity duration-200 ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
            style={{ bottom: `calc(24px + var(--nav-h) + ${NAV_LIFT})` }}
          >
            <ActionRail
              post={post}
              hasMute={hasVideo || hasAudio}
              onLike={() => void applyLike(!post.is_liked)}
              onComment={openComments}
              onBookmark={() => void toggleBookmark()}
              onRepost={() => void toggleRepost()}
              onShare={() => void share()}
              onOptions={() => setOptionsOpen(true)}
            />
          </div>

          <div
            className={`absolute left-4 transition-[right] duration-200 ${open ? "right-4" : "right-[76px]"}`}
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
      </section>

      {commentsOpen && (
        <CommentsSheet
          postId={post.id}
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
