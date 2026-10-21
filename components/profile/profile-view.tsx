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
import { useStoryRing, type StoryRingState } from "@/lib/stories/use-story-ring";
import { ProfileMenu } from "./profile-menu";
import { StoryRingAvatar } from "./story-ring-avatar";

type ListTab = "posts" | "reels" | "reposts" | "liked" | "saved";
type TabId = ListTab | "info";

// The plus on your own avatar (mobile) opens the composer with Story focused.
const STORY_COMPOSER_HREF = "/create?mode=story";

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
  posts: { name: "galleryWide", glow: "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]" },
  reels: { name: "clapperboard", glow: "text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.55)]" },
  reposts: { name: "repeat", glow: "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.55)]" },
  saved: { name: "bookmark", glow: "text-amber-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.55)]" },
  liked: { name: "heart", glow: "text-rose-600 drop-shadow-[0_0_10px_rgba(225,29,72,0.55)]" },
  info: { name: "infoCircle", glow: "text-info drop-shadow-[0_0_10px_rgba(76,141,255,0.55)]" },
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

// Cover mask (mobile): fades the left/right edges and the bottom into the screen black.
const COVER_MASK =
  "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)";

const WARM_GLOW = "bg-[radial-gradient(70%_90%_at_18%_0%,rgba(255,179,64,0.10),transparent_70%)]";

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
      <div className="flex items-start gap-4 px-4 pb-4 pt-24 md:gap-8 md:px-6 md:pt-8">
        <div className="size-[98px] shrink-0 animate-pulse rounded-full bg-card-elevated md:order-first md:size-[160px]" />
        <div className="order-first flex-1 space-y-3 md:order-none">
          <div className="h-6 w-44 animate-pulse rounded bg-card/70" />
          <div className="h-4 w-28 animate-pulse rounded bg-card/70" />
          <div className="h-10 w-56 animate-pulse rounded bg-card/70" />
        </div>
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
      className="grid size-10 place-items-center rounded-full border border-white/10 bg-black/30 text-white backdrop-blur-md transition active:scale-92"
    >
      {children}
    </button>
  );
}

function RoundBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/16 active:scale-92"
    >
      {children}
    </button>
  );
}

function Stat({ value, label, href, inline }: { value: number; label: string; href?: string; inline?: boolean }) {
  const inner = inline ? (
    <>
      <span className="text-section font-extrabold tracking-tight text-white">{formatCount(value)}</span>{" "}
      <span className="text-[15px] text-white/55">{label}</span>
    </>
  ) : (
    <>
      <p className="text-[21px] font-extrabold leading-none tracking-tight text-white text-shadow">{formatCount(value)}</p>
      <p className="mt-1.5 text-body text-white/55">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

// Avatar with its story ring; the blue + (mobile, own profile only) opens the composer on Story.
function AvatarBlock({
  profile,
  size,
  ring,
  showAdd,
  onView,
  onAddStory,
}: {
  profile: UserProfile;
  size: number;
  ring: StoryRingState;
  showAdd: boolean;
  onView: () => void;
  onAddStory: () => void;
}) {
  const outer = size + 10;
  return (
    <span className="relative inline-block shrink-0" style={{ width: outer, height: outer }}>
      <button
        type="button"
        aria-label="View profile picture"
        disabled={!profile.avatar}
        onClick={onView}
        className="block rounded-full transition hover:opacity-95"
      >
        <StoryRingAvatar url={profile.avatar} name={profile.name ?? profile.username} size={size} ring={ring} />
      </button>
      {showAdd && (
        <button
          type="button"
          aria-label="Add to your story"
          onClick={onAddStory}
          className="absolute bottom-[3%] right-[3%] grid size-[30px] place-items-center rounded-full bg-info text-white ring-[3px] ring-black transition active:scale-90"
        >
          <Icon name="plus" weight="strong" className="size-[22px]" />
        </button>
      )}
    </span>
  );
}

function NameRow({ profile, className }: { profile: UserProfile; className: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <h1 className={`truncate font-extrabold tracking-tight ${className}`}>{profile.name ?? profile.username}</h1>
      {profile.campus_verified && <Icon name="verifiedCheck" filled className="size-[22px] shrink-0 text-warm" />}
    </div>
  );
}

function InfoPanel({ profile }: { profile: UserProfile }) {
  const tagline = (profile.tagline ?? "").trim();
  const location = (profile.location ?? "").trim();
  const campus = profile.institution ? (profile.institution.short_name ?? profile.institution.name) : "";
  const links = profile.links.map((l) => ({ raw: l, parsed: safeHref(l) }));
  const empty = !tagline && !location && !campus && links.length === 0;

  if (empty) return <TabMessage title="Nothing here yet" sub="Tagline, location and links show up here" />;

  const row = "flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3.5 text-body text-white/90";
  return (
    <div className="space-y-2.5 px-4 py-5 md:px-0">
      {tagline && (
        <div className={row}>
          <Icon name="chatRoundDots" filled className="mt-0.5 size-[22px] shrink-0 text-white/60" />
          <span className="whitespace-pre-line leading-snug">{tagline}</span>
        </div>
      )}
      {location && (
        <div className={row}>
          <Icon name="pointOnMap" filled className="mt-0.5 size-[22px] shrink-0 text-white/60" />
          <span>{location}</span>
        </div>
      )}
      {campus && (
        <div className={row}>
          <Icon name="buildings" filled className="mt-0.5 size-[22px] shrink-0 text-warm" />
          <span className="font-semibold text-warm">{campus}</span>
        </div>
      )}
      {links.map(({ raw, parsed }) => (
        <div key={raw} className={row}>
          <Icon name="link" filled className="mt-0.5 size-[22px] shrink-0 text-info" />
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
  const ring = useStoryRing(profile?.id, authed && !!profile);
  const [tab, setTab] = useState<TabId>("posts");
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set<TabId>([...TABS.map((t) => t.id)]));
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

  const grid = useMemo<DiscoverItem[]>(
    () => curItems.map((p) => ({ id: String(p.id), kind: p.type === "listing" ? "listing" : "post", post: p, src: null, slot: 0 })),
    [curItems],
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
          <p className="mt-1.5 text-secondary text-muted">
            {notFound ? "This account doesn't exist or isn't available." : (error?.message ?? "Check your connection and try again.")}
          </p>
          {!notFound && (
            <button type="button" onClick={reload} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black">
              Reload profile
            </button>
          )}
        </div>
      </div>
    );
  }

  const bio = (profile.bio ?? "").trim();
  const total = profile.counts.posts + profile.counts.listings;
  const viewAvatar = () => profile.avatar && setLightbox({ url: profile.avatar, round: true });
  const addStory = () => router.push(STORY_COMPOSER_HREF);

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
      {/* ───────── MOBILE header: cover as a shadow behind everything, no card ───────── */}
      <section className="relative isolate overflow-hidden md:hidden">
        {profile.cover ? (
          <>
            <img
              src={profile.cover}
              alt=""
              decoding="async"
              className="absolute inset-0 -z-20 size-full object-cover saturate-[0.6]"
              style={{ WebkitMaskImage: COVER_MASK, maskImage: COVER_MASK, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
            />
            <span className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/55 to-black/72" />
          </>
        ) : (
          <span className={`absolute inset-0 -z-10 ${WARM_GLOW}`} />
        )}

        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
        >
          {own ? (
            <GlassBtn label="Edit profile" onClick={() => flash("Edit profile is coming to web")}>
              <Icon name="edit" weight="strong" className="size-7" />
            </GlassBtn>
          ) : (
            <GlassBtn label="Back" onClick={() => router.back()}>
              <Icon name="back" weight="strong" className="size-7" />
            </GlassBtn>
          )}
          <div className="flex items-center gap-2">
            <GlassBtn label="Share profile" onClick={() => void onShare()}>
              <Icon name="shareArrow" weight="strong" className="size-7" />
            </GlassBtn>
            {own ? (
              <GlassBtn label="Settings" onClick={() => flash("Settings are coming to web")}>
                <Icon name="hamburgerMenu" weight="strong" className="size-7" />
              </GlassBtn>
            ) : (
              <GlassBtn label="More options" onClick={() => setMenuOpen(true)}>
                <Icon name="menuDots" filled className="size-7" />
              </GlassBtn>
            )}
          </div>
        </div>

        <div className="relative px-4 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 76px)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pt-2">
              <NameRow profile={profile} className="text-[25px] leading-[1.1] text-white text-shadow" />
              <p className="mt-1 truncate text-[15px] text-white/55 text-shadow">@{profile.username}</p>
              <div className="mt-5 flex items-start gap-7">
                <Stat value={profile.counts.following} label="Following" href={`/u/${profile.username}/following`} />
                <Stat value={profile.counts.followers} label="Followers" href={`/u/${profile.username}/followers`} />
                <Stat value={total} label="Posts" />
              </div>
            </div>
            <AvatarBlock profile={profile} size={88} ring={ring} showAdd={own} onView={viewAvatar} onAddStory={addStory} />
          </div>

          {/* Bio spans the full width, like TikTok: it is not boxed into the stats column. */}
          {bio && <p className="mt-4 line-clamp-4 whitespace-pre-line text-[15px] leading-[1.45] text-white/90 text-shadow">{bio}</p>}

          {!own && (
            <button
              type="button"
              onClick={() => (following ? onMessage() : void onFollow())}
              className={`mt-4 h-11 w-full rounded-xl text-[15px] font-bold transition active:scale-98 ${
                following ? "border border-white/25 bg-black/30 text-white" : "bg-rose-600 text-white hover:bg-rose-500"
              }`}
            >
              {following ? "Message" : "Follow"}
            </button>
          )}
        </div>
      </section>

      {/* ───────── DESKTOP header: TikTok-web layout on plain black, with a warm glow ───────── */}
      <section className="relative isolate hidden overflow-hidden px-6 pb-6 pt-9 md:block">
        <span className={`absolute inset-0 -z-10 ${WARM_GLOW}`} />
        <div className="flex items-start gap-9">
          <AvatarBlock profile={profile} size={150} ring={ring} showAdd={false} onView={viewAvatar} onAddStory={addStory} />

          <div className="min-w-0 flex-1 pt-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <NameRow profile={profile} className="text-[26px] leading-tight text-white" />
              <span className="truncate text-label text-white/50">@{profile.username}</span>
            </div>

            <div className="mt-3 flex items-center gap-6">
              <Stat inline value={profile.counts.following} label="Following" href={`/u/${profile.username}/following`} />
              <Stat inline value={profile.counts.followers} label="Followers" href={`/u/${profile.username}/followers`} />
              <Stat inline value={total} label="Posts" />
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              {own ? (
                <>
                  <button
                    type="button"
                    onClick={() => flash("Edit profile is coming to web")}
                    className="h-11 rounded-full bg-white/10 px-6 text-[15px] font-semibold text-white transition hover:bg-white/16 active:scale-98"
                  >
                    Edit profile
                  </button>
                  <RoundBtn label="Settings" onClick={() => flash("Settings are coming to web")}>
                    <Icon name="hamburgerMenu" weight="strong" className="size-7" />
                  </RoundBtn>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => (following ? onMessage() : void onFollow())}
                  className={`h-11 min-w-[148px] rounded-full px-7 text-[15px] font-bold transition active:scale-98 ${
                    following ? "bg-white/10 text-white hover:bg-white/16" : "bg-rose-600 text-white hover:bg-rose-500"
                  }`}
                >
                  {following ? "Message" : "Follow"}
                </button>
              )}
              <RoundBtn label="Share profile" onClick={() => void onShare()}>
                <Icon name="shareArrow" weight="strong" className="size-7" />
              </RoundBtn>
              {!own && (
                <RoundBtn label="More options" onClick={() => setMenuOpen(true)}>
                  <Icon name="menuDots" filled className="size-7" />
                </RoundBtn>
              )}
            </div>

            {bio && <p className="mt-5 max-w-[620px] whitespace-pre-line text-[15px] leading-[1.5] text-white/90">{bio}</p>}
          </div>
        </div>
      </section>

      {/* Tabs: icon-only on mobile, labelled from md up. */}
      <div className="flex items-center justify-between border-b border-white/10 md:px-6">
        <div role="tablist" className="no-scrollbar flex w-full min-w-0 items-center overflow-x-auto md:w-auto md:gap-10 md:overflow-visible">
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
                className={`relative flex shrink-0 items-center justify-center gap-2.5 px-5 pb-3.5 pt-3.5 text-label font-bold transition md:px-0 md:pb-3 md:pt-2.5 ${
                  active ? "text-white" : "text-white/45 hover:text-white/75"
                }`}
              >
                <Icon name={ic.name} filled={active} className={`size-7 transition-all duration-200 ${active ? ic.glow : "text-white"}`} />
                <span className="hidden md:inline">{t.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-white md:inset-x-0 md:left-0 md:w-auto md:translate-x-0" />
                )}
              </button>
            );
          })}
        </div>

      </div>

      <div className="pt-0.5 md:px-6 md:pt-4">{body}</div>

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
        {sub && <p className="mt-1 text-secondary text-muted">{sub}</p>}
        {action && (
          <button type="button" onClick={action.onClick} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black">
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
