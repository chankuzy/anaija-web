/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiscoverGrid, DiscoverSkeleton } from "@/components/discover/discover-grid";
import { PostViewer } from "@/components/discover/post-viewer";
import { Icon, type IconName } from "@/components/ui/icon";
import { Lightbox } from "@/components/ui/lightbox";
import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { ApiError } from "@/lib/api/client";
import { usersApi, type UserProfile } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";
import { formatCount } from "@/lib/format";
import { usePaged } from "@/lib/paged/use-paged";
import { isReel, loadLiked, loadPosts, loadReposts, loadSaved, postsView, type PostsCursor } from "@/lib/profile/feeds";
import { useProfile } from "@/lib/profile/use-profile";
import { ProfileMenu } from "./profile-menu";
import { StoryRingAvatar, type StoryRingState } from "./story-ring-avatar";

type ListTab = "posts" | "reels" | "reposts" | "liked" | "saved";
type TabId = ListTab | "info";
type SortOption = "latest" | "popular" | "oldest";

const TABS: { id: TabId; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "reels", label: "Reels" },
  { id: "reposts", label: "Reposts" },
  { id: "saved", label: "Favorites" },
  { id: "liked", label: "Liked" },
  { id: "info", label: "About" },
];

// Official Solar icons: outline when inactive, bold when active.
const TAB_ICON: Record<TabId, { name: IconName; glow: string }> = {
  posts: { name: "galleryWide", glow: "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
  reels: { name: "clapperboard", glow: "text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" },
  reposts: { name: "repeat", glow: "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" },
  saved: { name: "bookmark", glow: "text-amber-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" },
  liked: { name: "heart", glow: "text-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.5)]" },
  info: { name: "infoCircle", glow: "text-info drop-shadow-[0_0_8px_rgba(76,141,255,0.5)]" },
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

const EMPTY_COPY: Record<ListTab, { title: string; sub: string }> = {
  posts: { title: "No posts yet", sub: "Everything shared shows up here" },
  reels: { title: "No reels yet", sub: "Video posts show up here automatically" },
  reposts: { title: "No reposts yet", sub: "Posts reposted from the feed show up here" },
  liked: { title: "No likes yet", sub: "Posts you like will show up here" },
  saved: { title: "No favorites yet", sub: "Tap the bookmark on anything you want to find again" },
};

// Cover mask: fades the left/right edges and the bottom into the screen black.
const COVER_MASK =
  "linear-gradient(to bottom, #000 0%, #000 42%, transparent 100%), linear-gradient(to right, transparent 0%, #000 24%, #000 76%, transparent 100%)";

function safeHref(raw: string): { href: string; label: string } | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname === "/" ? "" : u.pathname;
    return { href: u.toString(), label: `${u.host.replace(/^www\./, "")}${path}` };
  } catch {
    return null;
  }
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[935px]" aria-hidden="true">
      <div className="flex items-start gap-3 px-4 pb-4 pt-24 sm:px-7">
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-card/70" />
          <div className="h-4 w-28 animate-pulse rounded bg-card/70" />
          <div className="h-10 w-56 animate-pulse rounded bg-card/70" />
        </div>
        <div className="size-[92px] shrink-0 animate-pulse rounded-full bg-card-elevated sm:size-[116px]" />
      </div>
      <div className="mt-4">
        <DiscoverSkeleton />
      </div>
    </div>
  );
}

function GlassBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full border border-white/12 bg-black/35 text-white backdrop-blur-sm transition active:scale-95"
    >
      {children}
    </button>
  );
}

function InfoPanel({ profile }: { profile: UserProfile }) {
  const tagline = (profile.tagline ?? "").trim();
  const location = (profile.location ?? "").trim();
  const campus = profile.institution ? (profile.institution.short_name ?? profile.institution.name) : "";
  const links = profile.links.map((l) => ({ raw: l, parsed: safeHref(l) }));
  const empty = !tagline && !location && !campus && links.length === 0;

  if (empty) return <TabMessage title="Nothing here yet" sub="Tagline, location and links show up here" />;

  const row = "flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3.5 text-[14px] text-white/90";
  return (
    <div className="space-y-2.5 px-4 py-5 sm:px-0">
      {tagline && (
        <div className={row}>
          <Icon name="chatRoundDots" filled className="mt-0.5 size-[18px] shrink-0 text-white/60" />
          <span className="whitespace-pre-line leading-snug">{tagline}</span>
        </div>
      )}
      {location && (
        <div className={row}>
          <Icon name="pointOnMap" filled className="mt-0.5 size-[18px] shrink-0 text-white/60" />
          <span>{location}</span>
        </div>
      )}
      {campus && (
        <div className={row}>
          <Icon name="buildings" filled className="mt-0.5 size-[18px] shrink-0 text-warm" />
          <span className="font-semibold text-warm">{campus}</span>
        </div>
      )}
      {links.map(({ raw, parsed }) => (
        <div key={raw} className={row}>
          <Icon name="link" filled className="mt-0.5 size-[18px] shrink-0 text-info" />
          {parsed ? (
            <a href={parsed.href} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 break-all font-semibold text-info hover:underline">
              {parsed.label}
            </a>
          ) : (
            <span className="min-w-0 break-all text-white/70">{raw}</span>
          )}
        </div>
      ))}
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
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set<TabId>([...TABS.map((t) => t.id)]));
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; index: number } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; round: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // TODO(next): driven by the stories feed (has_unseen for this user), same as Flutter's storyRingProvider.
  const ring: StoryRingState = "none";

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

  const lists: Record<ListTab, { items: Post[]; src: PagedLike }> = {
    posts: { items: postsList, src: posts },
    reels: { items: reels, src: posts },
    reposts: { items: reposts.data?.items ?? EMPTY_POSTS, src: reposts },
    liked: { items: liked.data?.items ?? EMPTY_POSTS, src: liked },
    saved: { items: saved.data?.items ?? EMPTY_POSTS, src: saved },
  };

  const isInfo = tab === "info";
  const listTab: ListTab = isInfo ? "posts" : tab;
  const isPrivateTab = !own && (tab === "liked" || tab === "saved");
  const cur = lists[listTab];
  const src = cur.src;
  const curItems = isPrivateTab || isInfo ? EMPTY_POSTS : cur.items;

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

  const hasMore = !isInfo && !isPrivateTab && (src.data?.hasMore ?? false);
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
  const displayName = profile.name ?? profile.username;

  let body: React.ReactNode;
  if (isInfo) {
    body = <InfoPanel profile={profile} />;
  } else if (isPrivateTab) {
    body = <TabMessage title={tab === "liked" ? "Likes are private" : "Favorites are private"} />;
  } else if ((src.loading && !src.data) || (!src.data && !src.loading && visited.has(tab) && grid.length === 0 && !src.data)) {
    body = <DiscoverSkeleton />;
  } else if (src.data?.error && grid.length === 0) {
    body = <TabMessage title="Couldn't load" sub={src.data.error} action={{ label: "Try again", onClick: src.reload }} />;
  } else if (grid.length === 0 && !hasMore) {
    body = <TabMessage title={EMPTY_COPY[listTab].title} sub={EMPTY_COPY[listTab].sub} />;
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
    <div className="mx-auto w-full max-w-[935px] pb-8">
      {/* Header: no card. The cover is the background, faded into the screen black on all open edges. */}
      <section className="relative isolate overflow-hidden">
        {profile.cover && (
          <>
            <img
              src={profile.cover}
              alt=""
              decoding="async"
              className="absolute inset-0 -z-20 size-full object-cover saturate-[0.6]"
              style={{ WebkitMaskImage: COVER_MASK, maskImage: COVER_MASK, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
            />
            <span className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/55 to-black/70" />
          </>
        )}

        {/* Top bar */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
        >
          {own ? (
            <GlassBtn label="Edit profile" onClick={() => flash("Edit profile is coming to web")}>
              <Icon name="edit" className="size-5" />
            </GlassBtn>
          ) : (
            <GlassBtn label="Back" onClick={() => router.back()}>
              <Icon name="back" className="size-5" />
            </GlassBtn>
          )}
          <div className="flex items-center gap-2">
            <GlassBtn label="Share profile" onClick={() => void onShare()}>
              <Icon name="share" className="size-5" />
            </GlassBtn>
            {own ? (
              <GlassBtn label="Settings" onClick={() => flash("Settings are coming to web")}>
                <Icon name="settings" className="size-5" />
              </GlassBtn>
            ) : (
              <GlassBtn label="More options" onClick={() => setMenuOpen(true)}>
                <Icon name="menuDots" filled className="size-5" />
              </GlassBtn>
            )}
          </div>
        </div>

        {/* Identity row: text left, avatar + ring right */}
        <div
          className="relative flex items-start gap-3 px-4 pb-5 sm:gap-6 sm:px-7"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 74px)" }}
        >
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-extrabold leading-tight text-white text-shadow sm:text-[26px]">{displayName}</h1>
            <p className="mt-0.5 truncate text-[14px] text-white/60 text-shadow">@{profile.username}</p>

            <div className="mt-3.5 flex items-center gap-6 sm:gap-8">
              <Link href={`/u/${profile.username}/following`} className="transition hover:opacity-80">
                <p className="text-[19px] font-extrabold leading-none text-white text-shadow">{formatCount(profile.counts.following)}</p>
                <p className="mt-1 text-[13px] text-white/60">Following</p>
              </Link>
              <Link href={`/u/${profile.username}/followers`} className="transition hover:opacity-80">
                <p className="text-[19px] font-extrabold leading-none text-white text-shadow">{formatCount(profile.counts.followers)}</p>
                <p className="mt-1 text-[13px] text-white/60">Followers</p>
              </Link>
              <div>
                <p className="text-[19px] font-extrabold leading-none text-white text-shadow">{formatCount(total)}</p>
                <p className="mt-1 text-[13px] text-white/60">Posts</p>
              </div>
            </div>

            {bio && <p className="mt-3.5 line-clamp-3 whitespace-pre-line text-[14px] leading-snug text-white/90 text-shadow sm:text-[14.5px]">{bio}</p>}

            {!own && (
              <button
                type="button"
                onClick={() => (following ? onMessage() : void onFollow())}
                className={`mt-4 h-9 min-w-[132px] rounded-md px-6 text-[14px] font-bold transition active:scale-98 ${
                  following ? "border border-white/30 bg-black/30 text-white" : "bg-rose-600 text-white hover:bg-rose-500"
                }`}
              >
                {following ? "Message" : "Follow"}
              </button>
            )}
          </div>

          <button
            type="button"
            aria-label="View profile picture"
            disabled={!profile.avatar}
            onClick={() => profile.avatar && setLightbox({ url: profile.avatar, round: true })}
            className="shrink-0 rounded-full transition hover:opacity-95"
          >
            <span className="hidden sm:block">
              <StoryRingAvatar url={profile.avatar} name={displayName} size={110} ring={ring} />
            </span>
            <span className="sm:hidden">
              <StoryRingAvatar url={profile.avatar} name={displayName} size={86} ring={ring} />
            </span>
          </button>
        </div>
      </section>

      {/* Tabs: icon-only on mobile, with labels from sm up. Outline inactive / bold active. */}
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 sm:flex-row sm:items-center sm:px-6">
        <div role="tablist" className="flex w-full items-center sm:w-auto sm:gap-8">
          {TABS.map((t) => {
            const active = t.id === tab;
            const ic = TAB_ICON[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={t.label}
                onClick={() => selectTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-2 pb-3 pt-3 text-[16px] font-bold transition sm:flex-none sm:pt-2 ${
                  active ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon name={ic.name} filled={active} className={`size-[22px] transition-all duration-200 ${active ? ic.glow : "text-white"}`} />
                <span className="hidden sm:inline">{t.label}</span>
                {active && <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full bg-white sm:inset-x-0" />}
              </button>
            );
          })}
        </div>

        {!isInfo && (
          <div className="mx-3.5 mb-2 flex items-center self-start rounded-lg bg-white/8 p-1 sm:mx-0 sm:self-auto">
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
        )}
      </div>

      <div className="pt-0.5 sm:px-6 sm:pt-4">{body}</div>

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
