/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiscoverGrid, DiscoverSkeleton } from "@/components/discover/discover-grid";
import { PostViewer } from "@/components/discover/post-viewer";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
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
import { ProfileMenu } from "./profile-menu";

type TabId = "posts" | "reels" | "reposts" | "liked" | "saved";
type SortOption = "latest" | "popular" | "oldest";

const TABS: { id: TabId; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "reels", label: "Reels" },
  { id: "reposts", label: "Reposts" },
  { id: "saved", label: "Favorites" },
  { id: "liked", label: "Liked" },
];

// Official Solar icons: outline when inactive, bold when active. Reels = clapperboard.
const TAB_ICON: Record<TabId, { name: IconName; glow: string }> = {
  posts: { name: "galleryWide", glow: "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
  reels: { name: "clapperboard", glow: "text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" },
  reposts: { name: "repeat", glow: "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" },
  saved: { name: "bookmark", glow: "text-amber-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" },
  liked: { name: "heart", glow: "text-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.5)]" },
};

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
  saved: { title: "No favorites yet", sub: "Tap the bookmark on anything you want to find again" },
};

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[935px] p-4 sm:p-6" aria-hidden="true">
      <div className="flex gap-4 sm:gap-6">
        <div className="size-20 sm:size-28 shrink-0 animate-pulse rounded-full bg-card-elevated" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-5 w-36 sm:w-48 animate-pulse rounded bg-card/70" />
          <div className="h-4 w-48 sm:w-64 animate-pulse rounded bg-card/70" />
          <div className="h-8 w-28 sm:w-32 animate-pulse rounded-full bg-card/70" />
        </div>
      </div>
      <div className="mt-8">
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
  const [sort, setSort] = useState<SortOption>("latest");
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set<TabId>([...TABS.map(t => t.id)]));
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; index: number } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; round: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // TypeScript safe sorting property lookup across API model variants
  const sortedItems = useMemo(() => {
    const list = [...curItems];
    if (sort === "popular") {
      return list.sort((a, b) => {
        const likesA = (a as unknown as { likes_count?: number; like_count?: number; likes?: number }).likes_count ?? (a as unknown as { like_count?: number }).like_count ?? 0;
        const likesB = (b as unknown as { likes_count?: number; like_count?: number; likes?: number }).likes_count ?? (b as unknown as { like_count?: number }).like_count ?? 0;
        return likesB - likesA;
      });
    }
    if (sort === "oldest") {
      return list.reverse();
    }
    return list;
  }, [curItems, sort]);

  const grid = useMemo<DiscoverItem[]>(
    () => sortedItems.map((p) => ({ id: String(p.id), kind: p.type === "listing" ? "listing" : "post", post: p, src: null, slot: 0 })),
    [sortedItems],
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
    else reload();
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

  const bio = (profile.bio ?? "").trim();
  const total = profile.counts.posts + profile.counts.listings;

  let body: React.ReactNode;
  if (isPrivateTab) {
    body = <TabMessage title={tab === "liked" ? "Likes are private" : "Favorites are private"} />;
  } else if ((src.loading && !src.data) || (!src.data && !src.loading && visited.has(tab) && grid.length === 0 && !src.data)) {
    body = <DiscoverSkeleton />;
  } else if (src.data?.error && grid.length === 0) {
    body = <TabMessage title="Couldn't load" sub={src.data.error} action={{ label: "Try again", onClick: src.reload }} />;
  } else if (grid.length === 0 && !hasMore) {
    body = <TabMessage title={EMPTY_COPY[tab].title} sub={EMPTY_COPY[tab].sub} />;
  } else {
    body = (
      <>
        <DiscoverGrid items={grid} videoBadge="clapper" onOpen={(i) => setViewer({ items: grid, index: i })} />
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
    <div className="mx-auto w-full max-w-[935px] px-3.5 sm:px-6 pt-4 sm:pt-6 pb-8">
      {/* Header sits ON the cover: cover image as background, desaturated + dark scrim, content on top */}
      <section className="relative isolate overflow-hidden rounded-[22px] border border-white/8">
        {profile.cover ? (
          <img src={profile.cover} alt="" decoding="async" className="absolute inset-0 -z-20 size-full object-cover saturate-[0.55]" />
        ) : (
          <span className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,var(--color-card-elevated),var(--color-card-alt))]" />
        )}
        <span className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/68 to-black/82" />

        <div className="flex items-start gap-3.5 px-3.5 pb-5 pt-9 sm:gap-6 sm:px-7 sm:pb-7 sm:pt-14 md:gap-7">
          <button
            type="button"
            aria-label="View profile picture"
            disabled={!profile.avatar}
            onClick={() => profile.avatar && setLightbox({ url: profile.avatar, round: true })}
            className="shrink-0 rounded-full bg-black/40 p-[2px] ring-1 ring-white/20 transition hover:opacity-95"
          >
            <div className="hidden sm:block">
              <Avatar url={profile.avatar} name={profile.name ?? profile.username} size={116} />
            </div>
            <div className="sm:hidden">
              <Avatar url={profile.avatar} name={profile.name ?? profile.username} size={82} />
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
              <h1 className="truncate text-[18px] font-extrabold text-white sm:text-[22px]">{profile.name ?? profile.username}</h1>
              <span className="truncate text-[13px] font-normal text-white/60 sm:text-[15px]">@{profile.username}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3.5 text-[13.5px] sm:mt-2.5 sm:gap-5 sm:text-[15px]">
              <Link href={`/u/${profile.username}/following`} className="flex items-center gap-1 transition hover:opacity-80">
                <span className="font-extrabold text-white">{formatCount(profile.counts.following)}</span>
                <span className="text-[12.5px] text-white/65 sm:text-[13.5px]">Following</span>
              </Link>
              <Link href={`/u/${profile.username}/followers`} className="flex items-center gap-1 transition hover:opacity-80">
                <span className="font-extrabold text-white">{formatCount(profile.counts.followers)}</span>
                <span className="text-[12.5px] text-white/65 sm:text-[13.5px]">Followers</span>
              </Link>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-white">{formatCount(total)}</span>
                <span className="text-[12.5px] text-white/65 sm:text-[13.5px]">Likes</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-2.5">
              {own ? (
                <button
                  type="button"
                  onClick={() => router.push("/settings/profile")}
                  className="h-8 rounded-md bg-white/15 px-3.5 text-[13px] font-semibold text-white transition hover:bg-white/25 active:scale-98 sm:h-9 sm:px-5 sm:text-[14px]"
                >
                  Edit profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (following ? onMessage() : void onFollow())}
                  className={`h-8 rounded-md px-4 text-[13px] font-bold transition active:scale-98 sm:h-9 sm:px-6 sm:text-[14px] ${
                    following ? "border border-white/30 text-white" : "bg-rose-600 text-white hover:bg-rose-500"
                  }`}
                >
                  {following ? "Message" : "Follow"}
                </button>
              )}

              {own ? (
                <button
                  type="button"
                  aria-label="Settings"
                  onClick={() => router.push("/settings")}
                  className="grid size-8 place-items-center rounded-md bg-white/15 text-white transition hover:bg-white/25 active:scale-95 sm:size-9"
                >
                  <Icon name="settings" className="size-4.5 sm:size-5" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="More Options"
                  onClick={() => setMenuOpen(true)}
                  className="grid size-8 place-items-center rounded-md bg-white/15 text-white transition hover:bg-white/25 active:scale-95 sm:size-9"
                >
                  <Icon name="menuDots" filled className="size-4.5 sm:size-5" />
                </button>
              )}

              <button
                type="button"
                aria-label="Share profile"
                onClick={() => void onShare()}
                className="grid size-8 place-items-center rounded-md bg-white/15 text-white transition hover:bg-white/25 active:scale-95 sm:size-9"
              >
                <Icon name="share" className="size-4.5 sm:size-5" />
              </button>
            </div>

            {bio && <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-white/85 sm:mt-4 sm:text-[14.5px]">{bio}</p>}
          </div>
        </div>
      </section>

      {/* Tabs: official Solar icons, outline inactive / bold active, with warm glows */}
      <div className="mt-5 flex flex-col justify-between gap-3 border-b border-white/10 sm:mt-6 sm:flex-row sm:items-center">
        <div role="tablist" className="no-scrollbar flex items-center gap-5 overflow-x-auto scroll-smooth pb-0.5 sm:gap-8">
          {TABS.map((t) => {
            const active = t.id === tab;
            const ic = TAB_ICON[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.id)}
                className={`relative flex shrink-0 items-center gap-1.5 pb-3 text-[14.5px] font-bold transition sm:gap-2 sm:text-[16px] ${
                  active ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon name={ic.name} filled={active} className={`size-5 transition-all duration-200 ${active ? ic.glow : "text-white"}`} />
                <span>{t.label}</span>
                {active && <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-white" />}
              </button>
            );
          })}
        </div>

        {/* Sort Filter Selector Pill */}
        <div className="mb-2 flex items-center self-start rounded-lg bg-white/8 p-1 sm:mb-2 sm:self-auto">
          {(["latest", "popular", "oldest"] as SortOption[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize transition sm:px-3 sm:text-[12.5px] ${
                sort === s ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4">{body}</div>

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
