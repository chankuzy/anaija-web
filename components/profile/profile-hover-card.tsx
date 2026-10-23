/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { mediaUrl } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";
import { usersApi, type UserProfile } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";
import { formatCount } from "@/lib/format";
import { useStoryRing } from "@/lib/stories/use-story-ring";
import { StoryRingAvatar } from "./story-ring-avatar";

const W = 340;
const GAP = 10;
const MARGIN = 12;
const OPEN_MS = 350;
const CLOSE_MS = 220;
const TTL = 60_000;
const SHOWN_POSTS = 6;

// Same cover treatment as the mobile profile header.
const COVER_MASK =
  "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)";
const WARM_GLOW = "bg-[radial-gradient(70%_90%_at_18%_0%,rgba(255,179,64,0.10),transparent_70%)]";

type HoverData = { profile: UserProfile; posts: Post[] };
type Entry = { at: number; value: HoverData | null; p: Promise<HoverData> };

// One request pair per person per minute, shared by every avatar that points at them.
const cache = new Map<string, Entry>();

function load(username: string): Entry {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const entry = { at: Date.now(), value: null } as Entry;
  entry.p = Promise.all([
    usersApi.profile(username),
    usersApi
      .posts(username, null)
      .then((r) => r.data ?? [])
      .catch(() => [] as Post[]),
  ]).then(([profile, posts]) => {
    entry.value = { profile, posts };
    return entry.value;
  });
  entry.p.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  cache.set(key, entry);
  return entry;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-[14px]">
      <span className="font-extrabold text-white">{formatCount(value)}</span> <span className="text-white/55">{label}</span>
    </div>
  );
}

function Tile({ post }: { post: Post }) {
  const media = post.media ?? [];
  const m = media[0];
  const isVideo = !!post.video_url || media.some((x) => x.type === "video");
  const src =
    mediaUrl(post.thumbnail_url ?? null) ??
    mediaUrl(m?.thumbnail ?? null) ??
    (m && m.type !== "video" ? mediaUrl(m.url ?? null) : null);
  const c = m?.dominant_color?.replace("#", "") ?? "";
  const color = /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : undefined;
  const href = post.type === "listing" ? `/listing/${post.id}` : `/p/${post.id}`;
  const price = post.type === "listing" ? post.listing?.formatted_price : null;
  return (
    <Link href={href} className="group/tile relative block aspect-[3/4] overflow-hidden bg-card" style={{ backgroundColor: color }}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full object-cover transition-transform duration-300 group-hover/tile:scale-105"
        />
      )}
      {isVideo && (
        <span className="absolute right-1.5 top-1.5 text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
          <Icon name="play" filled className="size-4" />
        </span>
      )}
      {price && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
          {price}
        </span>
      )}
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="space-y-3 px-4 pb-4 pt-4">
        <div className="flex items-center gap-3.5">
          <div className="size-[74px] shrink-0 animate-pulse rounded-full bg-card-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-card" />
            <div className="h-4 w-20 animate-pulse rounded bg-card/70" />
          </div>
        </div>
        <div className="h-4 w-56 animate-pulse rounded bg-card/70" />
        <div className="h-10 w-full animate-pulse rounded-full bg-card" />
      </div>
      <div className="grid grid-cols-3 gap-0.5 border-t border-white/8 p-0.5">
        {Array.from({ length: SHOWN_POSTS }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse bg-card/70" />
        ))}
      </div>
    </div>
  );
}

function Loaded({ data }: { data: HoverData }) {
  const { profile, posts } = data;
  const router = useRouter();
  const ring = useStoryRing(profile.id, true);
  const following = useIsFollowing(profile.id, profile.is_following);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bio = (profile.bio ?? "").trim();
  const total = profile.counts.posts + profile.counts.listings;
  // The cached profile predates a follow made from this card, so adjust the count locally.
  const followers = Math.max(0, profile.counts.followers + (following === profile.is_following ? 0 : following ? 1 : -1));
  const href = `/u/${profile.username}`;
  const shown = posts.slice(0, SHOWN_POSTS);

  const onFollow = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const r = await toggleFollow(profile.id, following);
    setBusy(false);
    if (r === null) setErr("Unable to update follow");
  };
  const onMessage = () => {
    setErr(null);
    usersApi
      .openConversation(profile.id)
      .then((r) => router.push(`/messages/${r.conversation_id}`))
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : "Couldn't open the conversation"));
  };

  return (
    <>
      <section className="relative isolate overflow-hidden px-4 pb-4 pt-4">
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

        <div className="flex items-center gap-3.5">
          <Link href={href} aria-label="Open profile" className="shrink-0 transition-opacity hover:opacity-95">
            <StoryRingAvatar url={profile.avatar} name={profile.name ?? profile.username} size={64} ring={ring} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={href} className="flex min-w-0 items-center gap-1.5">
              <span className="text-shadow truncate text-[18px] font-extrabold leading-tight tracking-tight text-white">
                {profile.name ?? profile.username}
              </span>
              {profile.campus_verified && <Icon name="verifiedCheck" filled className="size-[18px] shrink-0 text-warm" />}
            </Link>
            <p className="text-shadow truncate text-[14px] text-white/55">@{profile.username}</p>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-5">
          <Stat value={profile.counts.following} label="Following" />
          <Stat value={followers} label="Followers" />
          <Stat value={total} label="Posts" />
        </div>

        {bio && <p className="text-shadow mt-3 line-clamp-3 whitespace-pre-line text-[14px] leading-[1.4] text-white/90">{bio}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => (following ? onMessage() : void onFollow())}
          className={`mt-3.5 h-10 w-full rounded-full text-[14px] font-bold transition active:scale-98 disabled:opacity-60 ${
            following ? "bg-white/10 text-white hover:bg-white/16" : "bg-brand text-brand-fg shadow-[0_0_18px_var(--color-brand-glow)] hover:bg-brand-hover"
          }`}
        >
          {following ? "Message" : "Follow"}
        </button>
        {err && <p className="mt-2 text-center text-supporting text-danger">{err}</p>}
      </section>

      <div className="border-t border-white/8">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-secondary text-muted">No posts yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {shown.map((p) => (
              <Tile key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function HoverCard({
  username,
  anchorRef,
  onEnter,
  onLeave,
  onClose,
}: {
  username: string;
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const [state, setState] = useState<{ data: HoverData | null; error: string | null }>(() => ({
    data: cache.get(username.toLowerCase())?.value ?? null,
    error: null,
  }));

  useEffect(() => {
    let off = false;
    load(username)
      .p.then((data) => {
        if (!off) setState({ data, error: null });
      })
      .catch((e: unknown) => {
        if (!off) setState({ data: null, error: e instanceof ApiError ? e.message : "Couldn't load profile" });
      });
    return () => {
      off = true;
    };
  }, [username]);

  // Sit under the avatar (or above it when there is no room), clamped to the screen; follows the card's own size.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.min(Math.max(a.left + a.width / 2 - W / 2, MARGIN), Math.max(MARGIN, vw - W - MARGIN));
      const below = a.bottom + GAP;
      const aboveTop = a.top - GAP - h;
      const above = below + h > vh - MARGIN && aboveTop >= MARGIN;
      const top = above ? aboveTop : Math.max(MARGIN, Math.min(below, vh - h - MARGIN));
      setPos((p) => (p && p.left === left && p.top === top && p.above === above ? p : { left, top, above }));
    };
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [anchorRef]);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`@${username}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("a")) onClose();
      }}
      className="fixed z-[55] w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-[0_24px_60px_rgba(0,0,0,0.65)] transition-[opacity,transform] duration-150 ease-out"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        opacity: pos ? 1 : 0,
        transform: pos ? "translateY(0) scale(1)" : "translateY(4px) scale(0.98)",
        transformOrigin: pos?.above ? "bottom center" : "top center",
        pointerEvents: pos ? "auto" : "none",
      }}
    >
      {state.data ? (
        <Loaded data={state.data} />
      ) : state.error ? (
        <p className="px-4 py-10 text-center text-secondary text-muted">{state.error}</p>
      ) : (
        <CardSkeleton />
      )}
    </div>
  );
}

// Wrap any avatar: hovering it (mouse only) opens that person's profile card.
// Nothing happens for guests, for your own avatar, or on that person's own profile screen.
export function ProfileHoverCard({
  username,
  children,
  className = "inline-flex shrink-0",
}: {
  username?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const { status, user } = useAuth();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const openT = useRef<number | undefined>(undefined);
  const closeT = useRef<number | undefined>(undefined);

  const name = username ?? "";
  const lower = name.toLowerCase();
  const path = (() => {
    try {
      return decodeURIComponent(pathname).toLowerCase();
    } catch {
      return pathname.toLowerCase();
    }
  })();
  const disabled =
    !name || status !== "authed" || user?.username?.toLowerCase() === lower || path === `/u/${lower}` || path.startsWith(`/u/${lower}/`);

  useEffect(
    () => () => {
      window.clearTimeout(openT.current);
      window.clearTimeout(closeT.current);
    },
    [],
  );

  const shown = open && !disabled;
  useEffect(() => {
    if (!shown) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("keydown", onKey);
    };
  }, [shown]);

  if (disabled) return <>{children}</>;

  const cancelClose = () => window.clearTimeout(closeT.current);
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelClose();
    if (open) return;
    window.clearTimeout(openT.current);
    openT.current = window.setTimeout(() => setOpen(true), OPEN_MS);
  };
  const leave = () => {
    window.clearTimeout(openT.current);
    cancelClose();
    closeT.current = window.setTimeout(() => setOpen(false), CLOSE_MS);
  };
  const dismiss = () => {
    window.clearTimeout(openT.current);
    cancelClose();
    setOpen(false);
  };

  return (
    <>
      <span ref={anchorRef} className={className} onPointerEnter={enter} onPointerLeave={leave} onClickCapture={dismiss}>
        {children}
      </span>
      {shown &&
        createPortal(
          <HoverCard username={name} anchorRef={anchorRef} onEnter={cancelClose} onLeave={leave} onClose={dismiss} />,
          document.body,
        )}
    </>
  );
}
