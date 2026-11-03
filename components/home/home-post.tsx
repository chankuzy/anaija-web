"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommentsSheet } from "@/components/feed/comments-sheet";
import { OptionsSheet, type SheetAction } from "@/components/feed/options-sheet";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { contentKind, type ContentKind } from "@/lib/feed/content";
import { usePostActions } from "@/lib/feed/use-post-actions";
import { PostActions, PostCaption, PostHeader } from "./post-anatomy";
import { RENDERERS } from "./renderers";

// Kinds whose body is pure media: edge to edge on phones (the renderers draw their own desktop card). Every other
// kind (text, poll, document, listing, ...) keeps its side padding so content never touches the screen edge.
const EDGE: ReadonlySet<ContentKind> = new Set<ContentKind>(["reel", "audioReel", "gallery"]);

export const HomePost = memo(function HomePost({
  post: raw,
  index,
  active,
  onVisible,
  patch,
  onRemove,
  extra,
  flush = false,
}: {
  post: Post;
  index: number;
  active: boolean;
  onVisible: (id: number, ratio: number) => void;
  patch: (id: number, p: Partial<Post>) => void;
  onRemove: (id: number) => void;
  /** Extra rows for the options sheet (e.g. community pin / remove / report). */
  extra?: SheetAction[];
  /** Drop the side padding when the host already pads. */
  flush?: boolean;
}) {
  const router = useRouter();
  const a = usePostActions(raw, { patch, onRemove });
  const post = a.post;
  const kind = contentKind(post);
  const R = RENDERERS[kind];
  const bodyRef = useRef<HTMLDivElement>(null);
  const burstTimer = useRef<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const id = raw.id;

  // Reports how much of the media is on screen; Home decides which post is "current" from these.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        const e = es[es.length - 1];
        if (e) onVisible(id, e.isIntersecting ? e.intersectionRatio : 0);
      },
      { threshold: [0, 0.25, 0.4, 0.6, 0.8, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      onVisible(id, 0);
    };
  }, [id, onVisible]);

  useEffect(
    () => () => {
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
    },
    [],
  );

  const open = () => {
    R.prepare?.(post);
    router.push(R.href(post));
  };
  const doubleLike = () => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBurst(true);
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
      burstTimer.current = window.setTimeout(() => setBurst(false), 700);
    }
    void a.like(true);
  };
  const openComments = useCallback(() => {
    if (!post.allow_comments) return a.flash("Comments are turned off for this post");
    if (!a.requireAuth("Sign in to join the conversation.")) return;
    setCommentsOpen(true);
  }, [post.allow_comments, a]);

  const pad = flush ? "" : "px-3 md:px-0";
  const bodyPad = flush || EDGE.has(kind) ? "" : "mx-3 md:mx-0";

  return (
    <article aria-label={`Post by ${post.author?.username ?? "Anaija"}`} className={flush ? "pb-8" : "mb-7 md:mb-10"}>
      <div className={`${pad} py-2 md:pb-3 md:pt-0`}>
        <PostHeader post={post} isOwn={a.isOwn} following={a.following} onFollow={a.follow} onMore={() => setOptionsOpen(true)} />
      </div>
      <div ref={bodyRef} className={`relative ${flush ? "mt-1" : ""} ${bodyPad}`}>
        <R.Body post={post} index={index} active={active} paused={commentsOpen || optionsOpen} onOpen={open} onLike={doubleLike} />
        {burst && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="heart-burst">
              <Icon name="heart" filled className="icon-shadow size-24 text-like" />
            </div>
          </div>
        )}
      </div>
      {R.Cta && (
        <div className={`${pad} mt-3`}>
          <R.Cta post={post} />
        </div>
      )}
      <div className={pad}>
        <PostActions
          post={post}
          onLike={() => void a.like(!post.is_liked)}
          onComment={openComments}
          onShare={a.share}
          onBookmark={() => void a.bookmark()}
        />
        {!R.ownsCaption && <PostCaption post={post} />}
        {post.allow_comments && post.comments_count > 0 && (
          <button type="button" onClick={openComments} className="mt-1 text-body text-muted">
            View all {post.comments_count} comments
          </button>
        )}
      </div>

      {a.toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
          style={{ bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)" }}
        >
          <span className="rounded-pill bg-black/80 px-3.5 py-2 text-xs font-semibold text-white">{a.toast}</span>
        </div>
      )}

      {commentsOpen && (
        <CommentsSheet
          postId={post.id}
          initialCount={post.comments_count}
          onCountChange={(n) => a.patch(post.id, { comments_count: n })}
          onClose={() => setCommentsOpen(false)}
        />
      )}
      {optionsOpen && (
        <OptionsSheet
          post={post}
          isOwn={a.isOwn}
          following={a.following}
          extra={extra}
          onClose={() => setOptionsOpen(false)}
          onFollow={a.follow}
          onNotInterested={() => {
            setOptionsOpen(false);
            a.notInterested();
          }}
          onDelete={a.deletePost}
        />
      )}
    </article>
  );
});
