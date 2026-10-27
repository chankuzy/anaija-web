/* eslint-disable @next/next/no-img-element */
"use client";

// Standalone post page (/p/:id) for everything that is not a reel or a listing: text and image posts, polls,
// documents, publications and announcements. Same actions, comments and options sheet as a Home post.
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CommentsSheet } from "@/components/feed/comments-sheet";
import { OptionsSheet } from "@/components/feed/options-sheet";
import { CaptionText, withHashtags } from "@/components/home/caption-text";
import { When } from "@/components/home/renderers/announcement";
import { DocumentPages, PdfAttachment, isPdfUrl } from "@/components/home/renderers/document";
import { ImageCarousel, slidesOf } from "@/components/home/renderers/image-carousel";
import { PollCard } from "@/components/home/renderers/poll";
import { PostActions, PostHeader } from "@/components/home/post-anatomy";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { postDetailApi } from "@/lib/api/post-detail";
import { useAuth } from "@/lib/auth/auth-context";
import { useCached } from "@/lib/cache/swr";
import { frameAspect, isImageMedia } from "@/lib/feed/content";
import { usePostActions } from "@/lib/feed/use-post-actions";
import { structuredOf, type ArticleBlock } from "@/lib/feed/structured";

const noop = () => {};

function Blocks({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="selectable">
      {blocks.map((b, i) => {
        if (b.type === "heading") return <h2 key={i} className="mt-9 text-[23px] font-extrabold leading-[1.25] tracking-tight text-fg">{b.text}</h2>;
        if (b.type === "quote")
          return (
            <blockquote key={i} className="mt-6 rounded-2xl bg-surface-subtle px-5 py-4 text-[18px] italic leading-[1.6] text-fg/90">
              {b.text}
            </blockquote>
          );
        if (b.type === "list")
          return (
            <ul key={i} className="mt-4 list-disc space-y-2 pl-6 text-[17px] leading-[1.6] text-fg/90">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        return <p key={i} className="mt-4 whitespace-pre-wrap text-[17px] leading-[1.75] text-fg/90">{b.text}</p>;
      })}
    </div>
  );
}

function Detail({ post, onLike }: { post: Post; onLike: () => void }) {
  const c = structuredOf(post);

  if (!c) {
    const slides = slidesOf(post);
    const caption = withHashtags(post.caption, post.hashtags);
    return (
      <div>
        {slides.length > 0 && (
          <ImageCarousel slides={slides} aspect={frameAspect("gallery", post)} index={0} active={false} paused onOpen={noop} onLike={onLike} label="Post images" />
        )}
        {caption && (
          <p className="selectable mt-4 whitespace-pre-wrap text-[17px] leading-[1.6] text-fg">
            <CaptionText text={caption} />
          </p>
        )}
      </div>
    );
  }

  if (c.kind === "poll") return <PollCard post={post} />;

  if (c.kind === "document") {
    return (
      <div>
        <h1 className="text-[26px] font-extrabold leading-[1.2] tracking-tight text-fg">{c.title || "Untitled document"}</h1>
        {c.description && <p className="selectable mt-2 whitespace-pre-wrap text-[16px] leading-[1.55] text-muted">{c.description}</p>}
        <div className="mt-4">
          <DocumentPages post={post} />
        </div>
      </div>
    );
  }

  if (c.kind === "article") {
    const cover = post.media.find(isImageMedia)?.url;
    return (
      <article>
        {cover && <img src={cover} alt="" className="aspect-[16/10] w-full rounded-image object-cover" />}
        <h1 className="mt-5 text-[30px] font-extrabold leading-[1.15] tracking-tight text-fg">{c.headline}</h1>
        {c.subtitle && <p className="mt-2 text-[18px] leading-[1.45] text-muted">{c.subtitle}</p>}
        <p className="mt-3 text-supporting font-semibold text-muted">{c.read_minutes} min read</p>
        <Blocks blocks={c.blocks} />
      </article>
    );
  }

  const images = post.media.filter(isImageMedia);
  const docs = post.media.filter((m) => (m.type ?? "").toLowerCase() === "document");
  return (
    <article className="rounded-image bg-surface-subtle p-5">
      <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.08em] text-muted">
        <span className="size-2 rounded-full bg-brand" />
        Announcement{c.publisher ? ` · ${c.publisher.name}` : ""}
      </p>
      <h1 className="mt-2 text-[26px] font-extrabold leading-[1.2] tracking-tight text-fg">{c.title}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <When label="Event" iso={c.event_at} />
        <When label="Deadline" iso={c.deadline_at} />
      </div>
      <p className="selectable mt-4 whitespace-pre-wrap text-[16px] leading-[1.65] text-fg/90">{c.body}</p>
      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {images.map((m) => (
            <img key={m.id} src={m.url ?? ""} alt="" className="aspect-square w-full rounded-2xl object-cover" />
          ))}
        </div>
      )}
      {docs.map((m) =>
        m.url && isPdfUrl(m.url) ? (
          <div key={m.id} className="mt-3">
            <PdfAttachment url={m.url} title={c.title} coverUrl={m.thumbnail} />
          </div>
        ) : (
          <a key={m.id} href={m.url ?? "#"} target="_blank" rel="noopener noreferrer" className="mt-3 flex h-12 items-center gap-3 rounded-2xl bg-surface-interactive px-4 text-body font-semibold text-fg">
            <Icon name="copy" filled className="size-5 text-muted" />
            Attached document
          </a>
        ),
      )}
    </article>
  );
}

function ReaderBody({ post: raw, focus, patch, onRemove }: { post: Post; focus?: number; patch: (id: number, p: Partial<Post>) => void; onRemove: (id: number) => void }) {
  const a = usePostActions(raw, { patch, onRemove });
  const post = a.post;
  const [commentsOpen, setCommentsOpen] = useState(focus !== undefined);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const openComments = useCallback(() => {
    if (!post.allow_comments) return a.flash("Comments are turned off for this post");
    if (!a.requireAuth()) return;
    setCommentsOpen(true);
  }, [post.allow_comments, a]);

  return (
    <>
      <PostHeader post={post} isOwn={a.isOwn} following={a.following} onFollow={a.follow} onMore={() => setOptionsOpen(true)} />
      <div className="mt-4">
        <Detail post={post} onLike={() => void a.like(true)} />
      </div>
      <PostActions post={post} onLike={() => void a.like(!post.is_liked)} onComment={openComments} onShare={a.share} onBookmark={() => void a.bookmark()} />
      {post.allow_comments && post.comments_count > 0 && (
        <button type="button" onClick={openComments} className="mt-1 text-secondary text-muted">
          View all {post.comments_count} comments
        </button>
      )}
      {a.toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 z-50 flex justify-center" style={{ bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)" }}>
          <span className="rounded-pill bg-black/80 px-3.5 py-2 text-xs font-semibold text-white">{a.toast}</span>
        </div>
      )}
      {commentsOpen && (
        <CommentsSheet postId={post.id} focusId={focus} initialCount={post.comments_count} onCountChange={(n) => a.patch(post.id, { comments_count: n })} onClose={() => setCommentsOpen(false)} />
      )}
      {optionsOpen && (
        <OptionsSheet
          post={post}
          isOwn={a.isOwn}
          following={a.following}
          onClose={() => setOptionsOpen(false)}
          onFollow={a.follow}
          onNotInterested={() => {
            setOptionsOpen(false);
            a.notInterested();
          }}
          onDelete={a.deletePost}
        />
      )}
    </>
  );
}

export function ContentReader({ id, initial }: { id: string; initial?: Post | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const cParam = Number(sp.get("comment"));
  const focus = Number.isInteger(cParam) && cParam > 0 ? cParam : undefined;
  const { status } = useAuth();
  const authed = status === "authed";
  const n = Number(id);
  const valid = Number.isInteger(n) && n > 0;
  const [local, setLocal] = useState<Partial<Post>>({});
  const fetcher = useCallback(() => postDetailApi.get(n), [n]);
  const { data: cached, error, mutate } = useCached<Post>(authed && valid ? `post:${n}` : null, fetcher, { staleMs: 30_000, persist: false });

  // Signed in: posts-show (viewer flags) once it arrives; the public copy paints instantly meanwhile.
  const post: Post | undefined = cached ?? (initial ? { ...initial, ...local } : undefined);
  const patch = useCallback(
    (_id: number, p: Partial<Post>) => {
      if (authed && cached) mutate((old) => ({ ...old, ...p }));
      else setLocal((o) => ({ ...o, ...p }));
    },
    [authed, cached, mutate],
  );
  const gone = useCallback(() => router.replace("/"), [router]);

  const toListing = !!post && (post.type === "listing" || !!post.listing);
  useEffect(() => {
    if (toListing) router.replace(`/l/${id}`);
  }, [toListing, router, id]);

  let msg: string | null = null;
  if (!valid) msg = "This post is not available.";
  else if (!post) {
    if (authed && error) msg = String(error).includes("404") ? "This post is not available." : "Could not load this post.";
    else if (!authed && initial === null) msg = "This post is not available.";
    else if (!authed && initial === undefined) msg = "Could not load this post.";
  }

  return (
    <div
      className="mx-auto w-full max-w-[680px] px-4 md:px-0"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 48px)" }}
    >
      <div className="flex h-12 items-center">
        <button
          type="button"
          aria-label="Back"
          onClick={() => (window.history.length > 1 ? router.back() : router.replace("/"))}
          className="-ml-2 grid size-11 place-items-center rounded-full text-fg"
        >
          <Icon name="back" className="size-5" />
        </button>
      </div>
      {msg ? (
        <p className="py-20 text-center text-[17px] font-bold text-fg">{msg}</p>
      ) : post && !toListing ? (
        <ReaderBody key={`${post.id}:${focus ?? ""}`} post={post} focus={focus} patch={patch} onRemove={gone} />
      ) : (
        <div className="sk-block h-64 rounded-image" />
      )}
    </div>
  );
}
