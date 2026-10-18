/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiscoverGrid, DiscoverSkeleton } from "@/components/discover/discover-grid";
import { PostViewer } from "@/components/discover/post-viewer";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Lightbox } from "@/components/ui/lightbox";
import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { ApiError } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";
import { formatCount } from "@/lib/format";
import { usePaged } from "@/lib/paged/use-paged";
import { isReel, loadLiked, loadPosts, loadReposts, loadSaved, postsView, type PostsCursor } from "@/lib/profile/feeds";
import { useProfile } from "@/lib/profile/use-profile";
import { GridGlyph, ReelGlyph } from "./glyphs";
import { ProfileMenu } from "./profile-menu";

type TabId = "posts" | "reels" | "reposts" | "liked" | "saved";
const TABS: TabId[] = ["posts", "reels", "reposts", "liked", "saved"];
const EMPTY_POSTS: Post[] = [];

interface PagedLike {
  data: { hasMore: boolean; loadingMore: boolean; moreError: boolean; error: string | null } | null;
  loading: boolean;
  reload: () => void;
  loadMore: (force?: boolean) => void;
  patch: (id: number, p: Partial<Post>) => void;
  remove: (id: number) => void;
}

const EMPTY_COPY: Record<TabId, { title: string; sub: string }> = {
  posts: { title: "No posts yet", sub: "Everything shared shows up here" },
  reels: { title: "No reels yet", sub: "Video posts show up here automatically" },
  reposts: { title: "No reposts yet", sub: "Posts reposted from the feed show up here" },
  liked: { title: "No likes yet", sub: "Posts you like will show up here" },
  saved: { title: "No saves yet", sub: "Tap the bookmark on anything you want to find again" },
};

function linkUri(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
const linkLabel = (raw: string) => raw.trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function GlassButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full border border-white/12 bg-black/35 text-white backdrop-blur"
    >
      {children}
    </button>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <span className="block text-[17px] font-bold text-fg">{formatCount(value)}</span>
      <span className="block text-[11px] text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="text-center">
      {inner}
    </Link>
  ) : (
    <div className="text-center">{inner}</div>
  );
}

function Pill({ filled, onClick, children, className = "" }: { filled?: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[34px] rounded-[10px] px-[18px] text-[13px] font-bold transition active:scale-[0.97] ${
        filled ? "bg-white text-black" : "border border-white/28 text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[935px]" aria-hidden="true">
      <div className="h-36 animate-pulse bg-card/70 md:h-52" />
      <div className="flex items-center gap-4 px-4">
        <div className="-mt-10 size-[86px] shrink-0 animate-pulse rounded-full bg-card-elevated" />
        <div className="h-8 flex-1 animate-pulse rounded-xl bg-card/70" />
      </div>
      <div className="mt-4 space-y-2 px-4">
        <div className="h-4 w-40 animate-pulse rounded bg-card/70" />
        <div className="h-3 w-56 animate-pulse rounded bg-card/70" />
      </div>
      <div className="mt-6">
        <DiscoverSkeleton />
      </div>
    </div>
  );
}

export function ProfileView({ username }: { username: string }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const authed = status === "authed";
  const own = user?.username === username;

  const { profile, error, loading, reload } = useProfile(username, authed);
  const [tab, setTab] = useState<TabId>("posts");
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set<TabId>(["posts"]));
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; index: number } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; round: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
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

  const loadPostsCb = useCallback((c: PostsCursor | null, s?: AbortSignal) => loadPosts(username, c, s), [username]);
  const loadRepostsCb = useCallback((c: number | null, s?: AbortSignal) => loadReposts(username, c, s), [username]);
  const posts = usePaged<Post, PostsCursor>({
    id: `posts:${username}`,
    enabled: authed && (visited.has("posts") || visited.has("reels")),
    load: loadPostsCb,
  });
  const reposts = usePaged<Post, number>({ id: `reposts:${username}`, enabled: authed && visited.has("reposts"), load: loadRepostsCb });
  const liked = usePaged<Post, string>({ id: `liked:${username}`, enabled: authed && own && visited.has("liked"), load: loadLiked });
  const saved = usePaged<Post, number>({ id: `saved:${username}`, enabled: authed && own && visited.has("saved"), load: loadSaved });

  const postsList = useMemo(() => postsView(posts.data?.items ?? EMPTY_POSTS, posts.data?.cursor ?? null), [posts.data]);
  const reels = useMemo(() => postsList.filter(isReel), [postsList]);

  const lists: Record<TabId, { items: Post[]; src: PagedLike }> = {
    posts: { items: postsList, src: posts },
    reels: { items: reels, src: posts },
    reposts: { items: reposts.data?.items ?? EMPTY_POSTS, src: reposts },
    liked: { items: liked.data?.items ?? EMPTY_POSTS, src: liked },
    saved: { items: saved.data?.items ?? EMPTY_POSTS, src: saved },
  };
  const isPrivateTab = !own && (tab === "liked" || tab === "saved");
  const cur = lists[tab];
  const src = cur.src;
  const curItems = isPrivateTab ? EMPTY_POSTS : cur.items;

  const grid = useMemo<DiscoverItem[]>(
    () => curItems.map((p) => ({ id: String(p.id), kind: p.type === "listing" ? "listing" : "post", post: p, src: null, slot: 0 })),
    [curItems],
  );

  const hasMore = !isPrivateTab && (src.data?.hasMore ?? false);
  const loadingMore = src.data?.loadingMore ?? false;
  const moreError = src.data?.moreError ?? false;
  const loadMore = src.loadMore;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadMore(), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [grid.length, hasMore, loadingMore, moreError, loadMore, tab]);

  const following = useIsFollowing(profile?.id, profile?.is_following ?? false);

  function flash(m: string) {
    setToast(m);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }

  function selectTab(t: TabId) {
    setTab(t);
    setVisited((prev) => (prev.has(t) ? prev : new Set(prev).add(t)));
  }

  async function onFollow() {
    if (!profile) return;
    const r = await toggleFollow(profile.id, following);
    if (r === null) flash("Unable to update follow");
    else reload(); // counts changed on both sides
  }

  function onMessage() {
    if (!profile) return;
    usersApi
      .openConversation(profile.id)
      .then((r) => router.push(`/messages/${r.conversation_id}`))
      .catch((e: unknown) => flash(e instanceof ApiError ? e.message : "Couldn't open the conversation"));
  }

  async function onShare() {
    if (!profile) return;
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) await navigator.share({ url, text: `${profile.name ?? profile.username} (@${profile.username}) on Anaija` });
      else {
        await navigator.clipboard.writeText(url);
        flash("Link copied");
      }
    } catch {
      /* cancelled */
    }
  }

  if (status === "loading" || status === "guest" || (loading && !profile)) return <ProfileSkeleton />;
  if (!profile) {
    const notFound = error?.status === 404;
    return (
      <div className="grid min-h-[70dvh] place-items-center px-6 text-center">
        <div>
          <p className="text-[17px] font-bold text-fg">{notFound ? "User not found" : "Couldn't load profile"}</p>
          <p className="mt-1.5 text-[13px] text-muted">
            {notFound ? "This account doesn't exist or isn't available." : (error?.message ?? "Check your connection and try again.")}
          </p>
          {!notFound && (
            <button type="button" onClick={reload} className="mt-5 h-10 rounded-full bg-white px-5 text-[13px] font-bold text-black">
              Reload profile
            </button>
          )}
        </div>
      </div>
    );
  }

  const loc = (profile.location ?? "").trim();
  const campus = profile.institution?.short_name?.trim() ?? "";
  const tagline = (profile.tagline ?? "").trim();
  const bio = (profile.bio ?? "").trim();
  const total = profile.counts.posts + profile.counts.listings;
  const links = profile.links;
  const shownLinks = linksOpen ? links : links.slice(0, 1);

  let body: React.ReactNode;
  if (isPrivateTab) {
    body = <TabMessage title={tab === "liked" ? "Likes are private" : "Collections are private"} />;
  } else if ((src.loading && !src.data) || (!src.data && !src.loading && visited.has(tab) && grid.length === 0 && !src.data)) {
    body = <DiscoverSkeleton />;
  } else if (src.data?.error && grid.length === 0) {
    body = <TabMessage title="Couldn't load" sub={src.data.error} action={{ label: "Try again", onClick: src.reload }} />;
  } else if (grid.length === 0 && !hasMore) {
    body = <TabMessage title={EMPTY_COPY[tab].title} sub={EMPTY_COPY[tab].sub} />;
  } else {
    body = (
      <>
        <DiscoverGrid items={grid} onOpen={(i) => setViewer({ items: grid, index: i })} />
        <div ref={sentinel} className="h-px" />
        {loadingMore && <div className="grid h-14 place-items-center text-sm text-muted">Loading…</div>}
        {moreError && (
          <button type="button" onClick={() => loadMore(true)} className="mx-auto block py-4 text-xs font-semibold text-muted">
            Couldn&apos;t load more · tap to retry
          </button>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[935px] pb-8">
      {/* Cover */}
      <div className="relative h-36 overflow-hidden md:h-52">
        {profile.cover ? (
          <button type="button" aria-label="View cover photo" className="absolute inset-0" onClick={() => setLightbox({ url: profile.cover!, round: false })}>
            <img src={profile.cover} alt="" className="size-full object-cover" />
          </button>
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#2b2b31,#131316)]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.42),rgba(0,0,0,0.55)_55%,#000)]" />
        <div className="absolute inset-x-3 flex items-center justify-between" style={{ top: "calc(10px + env(safe-area-inset-top))" }}>
          {own ? (
            <span />
          ) : (
            <GlassButton label="Back" onClick={() => router.back()}>
              <Icon name="back" className="size-5" />
            </GlassButton>
          )}
          {!own && (
            <GlassButton label="More" onClick={() => setMenuOpen(true)}>
              <Icon name="dots" filled className="size-5" />
            </GlassButton>
          )}
        </div>
        {tagline && (
          <span className="absolute bottom-3 left-[112px] max-w-[calc(100%-128px)] truncate rounded-[18px] border border-white/6 bg-[#2a2d32]/95 px-3.5 py-1.5 text-[14px] font-semibold italic text-[#afbbc9] shadow-lg">
            {tagline}
          </span>
        )}
      </div>

      {/* Avatar + stats */}
      <div className="flex items-center gap-4 px-4">
        <button
          type="button"
          aria-label="View profile picture"
          disabled={!profile.avatar}
          onClick={() => profile.avatar && setLightbox({ url: profile.avatar, round: true })}
          className="-mt-10 shrink-0 rounded-full bg-bg p-[3px]"
        >
          <Avatar url={profile.avatar} name={profile.name ?? profile.username} size={80} />
        </button>
        <div className="grid flex-1 grid-cols-3 gap-1">
          <Stat label="Followers" value={profile.counts.followers} href={`/u/${profile.username}/followers`} />
          <Stat label="Following" value={profile.counts.following} href={`/u/${profile.username}/following`} />
          <Stat label="Posts" value={total} />
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pt-3">
        <h1 className="truncate text-[17px] font-extrabold tracking-tight text-fg">{profile.name ?? profile.username}</h1>
        <p className="mt-px truncate text-[12.5px] text-muted">
          @{profile.username}
          {loc && ` · ${loc}`}
          {campus && <span className="font-semibold text-warm"> · {campus}</span>}
        </p>
        {bio && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[13.5px] leading-[1.3] text-fg">{bio}</p>}
        {links.length > 0 && (
          <div className="mt-1 flex flex-col items-start gap-0.5">
            {shownLinks.map((l) => {
              const href = linkUri(l);
              return href ? (
                <a key={l} href={href} target="_blank" rel="noopener noreferrer" className="flex max-w-full items-center gap-1 text-[13px] font-semibold text-info">
                  <Icon name="link" filled className="size-[13px] shrink-0" />
                  <span className="truncate">{linkLabel(l)}</span>
                </a>
              ) : null;
            })}
            {links.length > 1 && (
              <button type="button" onClick={() => setLinksOpen((o) => !o)} className="text-[12.5px] text-muted">
                {linksOpen ? "Show less" : `+${links.length - 1} more`}
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {!own && (
            <Pill
              filled={!following}
              className="flex-1"
              onClick={() => (following ? onMessage() : void onFollow())}
            >
              {following ? "Message" : "Follow"}
            </Pill>
          )}
          <Pill className={own ? "flex-1" : "min-w-[88px]"} onClick={() => void onShare()}>
            Share
          </Pill>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="sticky top-0 z-20 mt-3 flex border-b border-white/6 bg-bg">
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={t}
              onClick={() => selectTab(t)}
              className={`relative grid h-[46px] flex-1 place-items-center ${active ? "text-fg" : "text-muted"}`}
            >
              {t === "posts" && <GridGlyph filled={active} />}
              {t === "reels" && <ReelGlyph filled={active} />}
              {t === "reposts" && <Icon name="repeat" filled={active} className="size-[22px]" />}
              {t === "liked" && <Icon name="heart" filled={active} className="size-[22px]" />}
              {t === "saved" && <Icon name="bookmark" filled={active} className="size-[22px]" />}
              {active && <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-fg" />}
            </button>
          );
        })}
      </div>

      <div className="px-[2px] pt-[2px]">{body}</div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs font-semibold text-white">{toast}</span>
        </div>
      )}
      {menuOpen && (
        <ProfileMenu
          profile={profile}
          following={following}
          onClose={() => setMenuOpen(false)}
          onUnfollow={() => void onFollow()}
          onBlocked={() => router.back()}
          onToast={flash}
        />
      )}
      {lightbox && <Lightbox url={lightbox.url} round={lightbox.round} onClose={() => setLightbox(null)} />}
      {viewer && (
        <PostViewer items={viewer.items} startIndex={viewer.index} onClose={() => setViewer(null)} onPatch={src.patch} onRemove={src.remove} />
      )}
    </div>
  );
}

function TabMessage({ title, sub, action }: { title: string; sub?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="grid place-items-center px-6 py-20 text-center">
      <div>
        <p className="text-[15px] font-bold text-fg">{title}</p>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
        {action && (
          <button type="button" onClick={action.onClick} className="mt-5 h-10 rounded-full bg-white px-5 text-[13px] font-bold text-black">
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
