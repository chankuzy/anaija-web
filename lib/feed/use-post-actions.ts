"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { Post } from "@/lib/api/feed-types";
import { postsApi } from "@/lib/api/posts";
import { socialApi } from "@/lib/api/social";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { useShare } from "@/lib/share/share-context";
import { toggleFollow, useIsFollowing } from "./follow-store";
import { pickIx, setIx, useIx, withIx } from "./interactions";

// Engagement for one post on a non-immersive surface. Same stores and endpoints as FeedCard (interactions,
// follow-store, postsApi, socialApi), so a like on Home is a like everywhere. FeedCard keeps its own copy of these
// handlers for now; moving it onto this hook is a Phase 02 consolidation.
export function usePostActions(
  raw: Post,
  opts: { patch: (id: number, p: Partial<Post>) => void; onRemove: (id: number) => void },
) {
  const router = useRouter();
  const { status, user } = useAuth();
  const openShare = useShare();
  const ix = useIx(raw.id);
  const post = withIx(raw, ix);
  const shareCount = useRef(post.shares_count);
  const busyLike = useRef(false);
  const busyBookmark = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const isOwn = status === "authed" && !!post.author && user?.id === post.author.id;
  const following = useIsFollowing(post.author?.id, post.author?.is_following ?? false);

  const patch = (id: number, p: Partial<Post>) => {
    opts.patch(id, p);
    const k = pickIx(p);
    if (k) setIx(id, k);
  };

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }
  function requireAuth(): boolean {
    if (status === "authed") return true;
    router.push(loginHref());
    return false;
  }
  function onAuthFailure(e: unknown) {
    if (e instanceof ApiError && e.status === 401) router.push(loginHref());
  }

  async function like(target: boolean) {
    if (!requireAuth() || busyLike.current || post.is_liked === target) return;
    busyLike.current = true;
    const prev = { is_liked: post.is_liked, likes_count: post.likes_count };
    patch(post.id, { is_liked: target, likes_count: Math.max(0, post.likes_count + (target ? 1 : -1)) });
    try {
      let r = await postsApi.toggleLike(post.id);
      if (r.liked !== target) r = await postsApi.toggleLike(post.id); // server toggles: flip back once if our view was stale
      patch(post.id, { is_liked: r.liked, ...(typeof r.likes_count === "number" ? { likes_count: r.likes_count } : {}) });
    } catch (e) {
      patch(post.id, prev);
      onAuthFailure(e);
    } finally {
      busyLike.current = false;
    }
  }

  async function bookmark() {
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
    if (r === null) flash("Unable to update follow");
    return r;
  }

  function share() {
    shareCount.current = post.shares_count;
    openShare(
      post,
      (delta, serverCount) => {
        shareCount.current = serverCount ?? Math.max(0, shareCount.current + delta);
        patch(post.id, { shares_count: shareCount.current });
      },
      (p) => patch(post.id, p),
    );
  }

  function notInterested() {
    if (!requireAuth()) return;
    void socialApi.feedback(post.id, "not_interested").catch(() => {});
    opts.onRemove(post.id);
  }

  async function deletePost() {
    try {
      await socialApi.deletePost(post.id);
      opts.onRemove(post.id);
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Couldn't delete");
    }
  }

  return { post, isOwn, following, toast, flash, patch, requireAuth, like, bookmark, follow, share, notInterested, deletePost };
}
