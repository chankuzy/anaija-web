"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import type { Post } from "@/lib/api/feed-types";
import { shareApi, type ShareTarget } from "@/lib/api/share";
import { socialApi } from "@/lib/api/social";
import { useAuth } from "@/lib/auth/auth-context";
import { usePaged, type Page } from "@/lib/paged/use-paged";
import { copyLink as copyPostLink, nativeShare, openWhatsapp } from "@/lib/share/external";
import { WhatsappGlyph } from "@/components/share/whatsapp-glyph";
import { addPostToStory, sendToUser, useSentTo } from "@/lib/share/send";

export function Quick({
  icon,
  glyph,
  label,
  busy,
  active,
  onClick,
}: {
  icon?: IconName;
  glyph?: React.ReactNode;
  label: string;
  busy?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-2 text-white transition-transform active:scale-95 disabled:opacity-60"
    >
      <span className="grid size-14 place-items-center rounded-full bg-surface-interactive transition-colors hover:bg-surface-elevated">
        {glyph ?? (icon && <Icon name={icon} className={`size-[22px] ${busy ? "animate-pulse" : ""} ${active ? "text-brand" : ""}`} />)}
      </span>
      <span className="text-supporting font-semibold text-white/85">{label}</span>
    </button>
  );
}

function Row({ t, sent, onSend }: { t: ShareTarget; sent: boolean; onSend: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <Avatar url={t.avatar} name={t.name || t.username} size={42} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-fg">{t.name || t.username}</p>
        <p className="truncate text-supporting text-muted">@{t.username}</p>
      </div>
      <button
        type="button"
        disabled={sent}
        onClick={onSend}
        className={`flex h-8 min-w-[76px] items-center justify-center gap-1 rounded-full px-4 text-[13px] font-bold transition-transform active:scale-95 ${
          sent ? "bg-surface-interactive text-muted" : "bg-brand text-brand-fg"
        }`}
      >
        {sent ? (
          <>
            <Icon name="check" weight="strong" className="size-3.5" />
            Sent
          </>
        ) : (
          "Send"
        )}
      </button>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-2" aria-hidden="true">
          <span className="sk-block size-[42px] shrink-0 rounded-full" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="sk-block h-3.5 w-32 rounded" />
            <span className="sk-block h-3 w-20 rounded" />
          </span>
        </div>
      ))}
    </>
  );
}

export function ShareSheet({
  post,
  onShared,
  onReposted,
  onClose,
  flash,
}: {
  post: Post;
  onShared?: (delta: number, serverCount?: number) => void;
  onReposted?: (p: Partial<Post>) => void;
  onClose: () => void;
  flash: (text: string) => void;
}) {
  const { user } = useAuth();
  const { conversations, reloadStories } = useMessages();
  const sentTo = useSentTo(post.id);
  const [query, setQuery] = useState("");
  const [storyBusy, setStoryBusy] = useState(false);
  const [reposted, setReposted] = useState(post.is_reposted);
  const [repostBusy, setRepostBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const username = user?.username ?? null;
  const isOwn = !!user && user.id === post.author?.id;
  // The author's setting (or this post's own switch) decides this; null follows the account default (allowed).
  const canStory = post.type !== "story" && (isOwn || post.allow_story_sharing !== false);

  // Focus lands inside the sheet so typing / arrow keys never reach the feed behind it.
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, []);

  // Page-level scroll hijackers (feed paging) must not see gestures made inside the sheet.
  useEffect(() => {
    const isolate = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-share-sheet]")) e.stopPropagation();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("wheel", isolate, opts);
    window.addEventListener("touchmove", isolate, opts);
    return () => {
      window.removeEventListener("wheel", isolate, opts);
      window.removeEventListener("touchmove", isolate, opts);
    };
  }, []);

  const load = useCallback(
    async (cursor: number | null, signal?: AbortSignal): Promise<Page<ShareTarget, number>> => {
      const page = cursor ?? 1;
      const r = await shareApi.following(username as string, page, signal);
      return { items: r.items, cursor: r.hasMore ? page + 1 : null, hasMore: r.hasMore };
    },
    [username],
  );
  const { data, loading, loadMore, reload } = usePaged<ShareTarget, number>({
    id: `share-following:${username ?? ""}`,
    enabled: !!username,
    load,
    staleMs: 120_000,
  });

  // Recent chats first, then everyone you follow (deduplicated).
  const people = useMemo(() => {
    const seen = new Set<number>();
    const out: ShareTarget[] = [];
    const recent: ShareTarget[] = (conversations ?? []).flatMap((c) =>
      c.other_user
        ? [
            {
              id: c.other_user.id,
              name: c.other_user.name,
              username: c.other_user.username,
              avatar: c.other_user.avatar,
              conversationId: c.id,
            },
          ]
        : [],
    );
    for (const t of [...recent, ...(data?.items ?? [])]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    const q = query.trim().toLowerCase();
    return q ? out.filter((t) => t.name.toLowerCase().includes(q) || t.username.toLowerCase().includes(q)) : out;
  }, [conversations, data, query]);

  // Searching should find people beyond the pages loaded so far.
  const hasMore = data?.hasMore ?? false;
  const loadingMore = data?.loadingMore ?? false;
  const searching = query.trim().length > 0;
  useEffect(() => {
    if (searching && people.length < 8 && hasMore && !loadingMore) loadMore();
  }, [searching, people.length, hasMore, loadingMore, loadMore]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 480) loadMore();
  };

  const canRepost = post.type === "post" && !!onReposted;
  const toRepost = async () => {
    if (repostBusy) return;
    setRepostBusy(true);
    const want = !reposted;
    try {
      let r = await socialApi.toggleRepost(post.id);
      // The server toggles: if our view was stale it landed on the opposite, so flip back once.
      if ((r.reposted ?? want) !== want) r = await socialApi.toggleRepost(post.id);
      const done = r.reposted ?? want;
      setReposted(done);
      onReposted?.({
        is_reposted: done,
        reposts_count: typeof r.reposts_count === "number" ? r.reposts_count : Math.max(0, post.reposts_count + (done ? 1 : -1)),
      });
      flash(done ? "Reposted" : "Repost removed");
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Couldn't repost");
    } finally {
      setRepostBusy(false);
    }
  };

  const copyLink = async () => {
    flash((await copyPostLink(post)) ? "Link copied" : "Couldn't copy the link");
  };

  // A dismissed OS sheet is not a share and shows nothing. No OS sheet (most desktops) falls back to copying.
  const more = async () => {
    const r = await nativeShare(post);
    if (r === "failed") flash("Couldn't open sharing");
    else if (r === "unsupported") await copyLink();
  };

  const whatsapp = () => {
    openWhatsapp(post);
  };

  const toStory = async () => {
    if (storyBusy) return;
    setStoryBusy(true);
    try {
      const r = await addPostToStory(post.id);
      if (r === "busy") {
        setStoryBusy(false);
        return;
      }
      reloadStories();
      flash(r === "duplicate" ? "Already in your story" : "Added to your story");
      onClose();
    } catch (e) {
      setStoryBusy(false);
      flash(e instanceof ApiError ? e.message : "Couldn't add to your story");
    }
  };

  const firstLoad = loading && (conversations === null || conversations.length === 0);
  const empty = !firstLoad && people.length === 0 && !loadingMore;

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-share-sheet
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center outline-none md:items-center"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div
        className="glass relative m-2.5 flex h-[min(78dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-floating"
        style={{ marginBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <div className="relative flex h-12 shrink-0 items-center justify-center">
          <span className="absolute top-2 h-1 w-9 rounded-full bg-white/20 md:hidden" />
          <h2 className="mt-1.5 text-[16px] font-bold tracking-tight text-fg md:mt-0">Share</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-2 hidden size-9 place-items-center rounded-full text-fg hover:bg-white/8 md:grid"
          >
            <Icon name="close" weight="regular" className="size-5" />
          </button>
        </div>

        <div className="flex shrink-0 px-4 pt-2">
          {canStory && <Quick icon="plus" label="Add to story" busy={storyBusy} onClick={() => void toStory()} />}
          {canRepost && <Quick icon="repeat" label={reposted ? "Undo repost" : "Repost"} active={reposted} busy={repostBusy} onClick={() => void toRepost()} />}
          <Quick glyph={<WhatsappGlyph className="size-[22px]" />} label="WhatsApp" onClick={whatsapp} />
          <Quick icon="copy" label="Copy link" onClick={() => void copyLink()} />
          <Quick icon="shareArrow" label="More" onClick={() => void more()} />
        </div>

        <div className="shrink-0 px-4 pt-5">
          <label className="flex h-11 items-center gap-2.5 rounded-full bg-surface-interactive px-3.5">
            <Icon name="search" className="size-[18px] shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              enterKeyHint="search"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-muted"
            />
          </label>
        </div>

        <p className="shrink-0 px-5 pb-1.5 pt-[18px] text-micro font-bold uppercase tracking-[0.12em] text-muted">Send to</p>

        <div data-share-scroll onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {firstLoad ? (
            <SkeletonRows n={6} />
          ) : data?.error && people.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-secondary text-muted">Couldn&apos;t load your people.</p>
              <button type="button" onClick={reload} className="h-9 rounded-full bg-brand px-5 text-[13px] font-extrabold text-brand-fg">
                Try again
              </button>
            </div>
          ) : empty ? (
            <p className="px-6 py-10 text-center text-secondary text-muted">
              {searching ? `No one matches "${query.trim()}"` : "No one to share with yet"}
            </p>
          ) : (
            <>
              {people.map((t) => (
                <Row
                  key={t.id}
                  t={t}
                  sent={sentTo.has(t.id)}
                  onSend={() => sendToUser(post.id, t.id, t.conversationId, { name: t.name || t.username, onShared, onError: flash })}
                />
              ))}
              {loadingMore ? (
                <SkeletonRows n={2} />
              ) : !hasMore && people.length > 0 ? (
                <p className="py-4 text-center text-supporting text-muted">That&apos;s everyone</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
