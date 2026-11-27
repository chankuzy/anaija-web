/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { MoreSkeleton, Sk } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { normPost } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";
import { postsApi } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/auth-context";
import { openAuth } from "@/lib/auth/auth-modal";
import { useRenders } from "@/lib/dev/perf";
import { coverOf } from "@/lib/discover/tile";
import { setIx, useIx, withIx } from "@/lib/feed/interactions";
import { formatCount } from "@/lib/format";
import { formatCompactLocation } from "@/lib/location/types";

const TYPES: { id: string; label: string; icon: IconName | null }[] = [
  { id: "", label: "All", icon: null },
  { id: "product", label: "Products", icon: "bag" },
  { id: "service", label: "Services", icon: "suitcase" },
  { id: "rental", label: "Rentals", icon: "home" },
  { id: "business", label: "Businesses", icon: "shop" },
  { id: "wanted", label: "Wanted", icon: "search" },
];
const SORTS = [
  { id: "relevance", label: "Trending" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Lowest price" },
  { id: "price_desc", label: "Highest price" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const PREFIX: Record<string, string> = { service: "From", business: "From", wanted: "Budget" };
const COND: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };

// Brand palette: yellow for primary actions and highlights, white for selection and secondary actions.
const BTN_YELLOW = "bg-brand text-brand-fg hover:bg-brand-hover";
const BTN_WHITE = "bg-fg text-bg hover:bg-fg";
const TEXT_YELLOW = "text-brand";

// Card geometry is fixed so every card is identical whatever it contains:
// image 5:4 + body 92px (10 pad + 18 title + 4 gap + 22 price + 8 gap + 20 meta + 10 pad).
const CARD_BODY = "h-[92px]";

const RM = "(prefers-reduced-motion: reduce)";

interface Raw {
  listings?: Post[];
  next_cursor?: string | null;
  has_more?: boolean;
  no_campus?: boolean;
}
interface Page {
  key: string;
  items: Post[];
  cursor: string | null;
  hasMore: boolean;
  noCampus: boolean;
  loadingMore: boolean;
  error: string | null;
}
interface HomeData {
  trending: Post[];
  fresh: Post[];
  noCampus: boolean;
  error: string | null;
}

// The server scopes every page to the viewer's own campus; nothing campus-related is sent from here.
async function fetchPage(type: string, sort: SortId, cursor: string | null, signal: AbortSignal) {
  const res = await api.get<Raw>(
    "marketplace-index",
    { listing_type: type || undefined, sort, cursor: cursor ?? undefined },
    signal,
  );
  return {
    items: (res.listings ?? []).map((p) => normPost(p)),
    cursor: res.next_cursor ?? null,
    hasMore: res.has_more === true,
    noCampus: res.no_campus === true,
  };
}

/* ───────────────────────────── Image ───────────────────────────── */

// Fades an image in once it is loaded AND decoded, so it never pops in mid-scroll. An image that is already in the
// browser's memory cache shows at once with no fade. The parent owns the box and its background colour.
const T_FADE = "[transition:opacity_300ms_ease-out,transform_500ms_ease-out] motion-reduce:[transition:none]";
const T_NOFADE = "[transition:transform_500ms_ease-out] motion-reduce:[transition:none]";

function FadeImg({
  src,
  className = "",
  priority = false,
  width,
  height,
  onError,
}: {
  src: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  onError?: () => void;
}) {
  const [st, setSt] = useState<0 | 1 | 2>(0); // 0 loading, 1 revealed with fade, 2 was already cached
  const attach = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setSt((s) => (s === 0 ? 2 : s));
  }, []);
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const done = () => setSt((s) => (s === 0 ? 1 : s));
    if (typeof el.decode === "function") el.decode().then(done, done);
    else done();
  };
  return (
    <img
      ref={attach}
      src={src}
      alt=""
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
      onLoad={onLoad}
      onError={onError}
      className={`${className} ${st === 0 ? "opacity-0" : "opacity-100"} ${st === 2 ? T_NOFADE : T_FADE}`}
    />
  );
}

/* ───────────────────────────── Banner ───────────────────────────── */

type BannerAction = "all" | "sell" | "services";
const SLIDES: { title: string; accent: string; sub: string; cta: string; action: BannerAction }[] = [
  { title: "Discover Quality Products,", accent: "Better Prices.", sub: "Shop smart. Live better.", cta: "Explore Marketplace", action: "all" },
  { title: "Sell in minutes,", accent: "reach your campus.", sub: "List it free. Chat with buyers.", cta: "Start selling", action: "sell" },
  { title: "Need a hand?", accent: "Trusted services nearby.", sub: "Tutoring, repairs and more.", cta: "Browse services", action: "services" },
];

// banner-band.webp is the 457x550 band (y 250..800) of banner.png: the bag, its handles and the three icon bubbles.
// The box has exactly that aspect ratio, so the whole bag always shows, scaled to the banner height.
const ART_ASPECT = 457 / 550;

function Banner({ onAction }: { onAction: (a: BannerAction) => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia(RM).matches) return; // reduced motion: no auto-rotation, the dots still work
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 5500);
    return () => clearTimeout(t);
  }, [i, paused]);

  return (
    <section
      className="relative isolate h-[200px] overflow-hidden rounded-[26px] border border-fg/10 bg-black md:h-[260px]"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-24 size-72 bg-[radial-gradient(closest-side,rgba(255,216,77,0.12),rgba(255,216,77,0))]"
      />

      <div
        aria-hidden
        className="absolute inset-y-0 right-1 overflow-hidden md:right-10"
        style={{ aspectRatio: String(ART_ASPECT) }}
      >
        <FadeImg src="/brand/market/banner-band.webp" width={457} height={550} priority className="absolute inset-0 size-full object-cover" />
        {/* Thin edge blend only; the artwork's own background is already black. */}
        <div className="absolute inset-y-0 left-0 w-[14%] bg-[linear-gradient(90deg,#000,rgba(0,0,0,0))]" />
        <div className="absolute inset-x-0 top-0 h-[10%] bg-[linear-gradient(180deg,#000,rgba(0,0,0,0))]" />
        <div className="absolute inset-x-0 bottom-0 h-[10%] bg-[linear-gradient(0deg,#000,rgba(0,0,0,0))]" />
      </div>

      {SLIDES.map((s, n) => {
        const active = n === i;
        return (
          <div
            key={s.title}
            aria-hidden={!active}
            className={`absolute inset-y-0 left-0 flex w-[62%] flex-col justify-center pb-5 pl-5 transition-[opacity,transform] duration-500 motion-reduce:transition-none md:w-[52%] md:pl-8 ${
              active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <p className="text-[20px] font-extrabold leading-[1.12] tracking-tight text-fg md:text-[32px]">
              {s.title}
              <span className={`block ${TEXT_YELLOW}`}>{s.accent}</span>
            </p>
            <p className="mt-1.5 text-[12px] text-fg/75 md:text-[14px]">{s.sub}</p>
            <button
              type="button"
              tabIndex={active ? 0 : -1}
              onClick={() => onAction(s.action)}
              className={`mt-3 inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-transform active:scale-95 motion-reduce:active:scale-100 md:h-11 md:px-6 md:text-[14px] ${BTN_WHITE}`}
            >
              {s.cta}
              <span aria-hidden>→</span>
            </button>
          </div>
        );
      })}

      <span className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
        {i + 1} / {SLIDES.length}
      </span>
      <div className="absolute bottom-3 left-5 z-10 flex items-center gap-1.5 md:left-8">
        {SLIDES.map((s, n) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Banner ${n + 1}`}
            onClick={() => setI(n)}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${n === i ? "w-5 bg-fg" : "w-1.5 bg-fg/25"}`}
          />
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────── Cards ───────────────────────────── */

// Same store and endpoint as the feed's like (interactions + postsApi), so a like here is a like everywhere.
export function useLike(raw: Post) {
  const { status } = useAuth();
  const ix = useIx(raw.id);
  const post = withIx(raw, ix);
  const busy = useRef(false);

  async function toggle() {
    if (status !== "authed") return openAuth({ reason: "Sign in to like listings." });
    if (busy.current) return;
    busy.current = true;
    const target = !post.is_liked;
    const prev = { is_liked: post.is_liked, likes_count: post.likes_count };
    setIx(post.id, { is_liked: target, likes_count: Math.max(0, post.likes_count + (target ? 1 : -1)) });
    try {
      let r = await postsApi.toggleLike(post.id);
      if (r.liked !== target) r = await postsApi.toggleLike(post.id); // server toggles: flip back once if our view was stale
      setIx(post.id, { is_liked: r.liked, ...(typeof r.likes_count === "number" ? { likes_count: r.likes_count } : {}) });
    } catch (e) {
      setIx(post.id, prev);
      if (e instanceof ApiError && e.status === 401) openAuth({ reason: "Your session ended. Sign in again to continue." });
    } finally {
      busy.current = false;
    }
  }
  return { post, liked: post.is_liked, toggle };
}

// Every row below always renders at a fixed height and never wraps, so content can't change the card's size.
// Memoised: a list update (next page, loading flag) must not re-render cards whose post did not change.
export const MarketCard = memo(function MarketCard({ post: raw, priority = false }: { post: Post; priority?: boolean }) {
  useRenders("MarketCard");
  const [failed, setFailed] = useState(false);
  const { post, liked, toggle } = useLike(raw);
  const d = post.listing;
  const type = post.listing_type ?? "product";
  const cover = coverOf(post);
  const title = ((type === "business" ? d?.business_name : null) || post.caption || "").trim().split("\n")[0];
  const where = d?.location_info ? formatCompactLocation(d.location_info) : d?.pickup_info || post.location || "";
  const prefix = PREFIX[type];
  const views = post.views_count ?? (d as unknown as { views_count?: number } | null)?.views_count ?? 0;
  // Listing condition (New, Like new, ...). Rentals and services carry no condition, so rentals say so instead.
  const badge = d?.condition ? (COND[d.condition] ?? null) : type === "rental" ? "For Rent" : null;

  return (
    <div className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-fg/[0.07] bg-card transition-[border-color,transform] duration-150 hover:border-fg/15 has-[a:active]:scale-[0.985] motion-reduce:transition-none motion-reduce:has-[a:active]:scale-100">
      <Link href={`/l/${post.id}`} className="flex h-full min-w-0 flex-col">
        <div
          className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-card-elevated"
          style={{ backgroundColor: cover.color ?? undefined }}
        >
          {cover.url && !failed ? (
            <FadeImg
              src={cover.url}
              priority={priority}
              onError={() => setFailed(true)}
              className="absolute inset-0 size-full object-cover group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#26211c,#141416)] text-fg/35">
              <Icon name="bag" filled className="size-8" />
            </span>
          )}
          {badge && (
            <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold leading-4 text-white">
              {badge}
            </span>
          )}
        </div>
        <div className={`${CARD_BODY} shrink-0 overflow-hidden p-2.5`}>
          <p className="h-[18px] truncate text-[13px] font-semibold leading-[18px] text-fg">{title || "Listing"}</p>
          <p className="mt-1 flex h-[22px] items-baseline gap-1 overflow-hidden whitespace-nowrap text-[16px] font-extrabold leading-[22px] tracking-tight text-fg">
            {d ? (
              <>
                {prefix && <span className="shrink-0 text-[11px] font-medium text-muted">{prefix}</span>}
                <span className="min-w-0 truncate">
                  <span className="mr-px text-brand">₦</span>
                  {d.formatted_price}
                </span>
              </>
            ) : null}
          </p>
          <div className="mt-2 flex h-5 items-center justify-between gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] leading-5 text-muted">{where}</span>
            {views > 0 && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-surface-interactive px-1.5 text-[10px] font-semibold text-fg/80">
                <Icon name="eye" className="size-3" />
                {formatCount(views).toLowerCase()}
              </span>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={liked ? "Remove like" : "Like"}
        aria-pressed={liked}
        onClick={toggle}
        className="hit-area absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 transition-transform active:scale-90 motion-reduce:active:scale-100"
      >
        <Icon name="heart" filled={liked} className={`size-[18px] transition-colors duration-150 ${liked ? "text-like" : "text-fg"}`} />
      </button>
    </div>
  );
});

// Same outer dimensions as MarketCard so nothing shifts when data arrives.
function CardSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-fg/[0.07] bg-card">
      <Sk className="aspect-[5/4] w-full shrink-0 rounded-none" />
      <div className={`${CARD_BODY} shrink-0 p-2.5`}>
        <Sk className="h-[18px] w-[75%] rounded-full" />
        <Sk className="mt-1 h-[22px] w-[45%] rounded-full" />
        <Sk className="mt-2 h-5 w-[60%] rounded-full" />
      </div>
    </div>
  );
}

function SectionHead({ icon, title, onSeeAll }: { icon: IconName; title: string; onSeeAll: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold tracking-tight text-fg">
        <Icon name={icon} filled className="size-6" />
        {title}
      </h2>
      <button type="button" onClick={onSeeAll} className="text-[13px] font-bold text-fg/80 transition-colors hover:text-fg active:text-fg">
        See all <span aria-hidden>→</span>
      </button>
    </div>
  );
}

function ServicesStrip({ onExplore }: { onExplore: () => void }) {
  return (
    <button
      type="button"
      onClick={onExplore}
      className="flex w-full items-center gap-3 rounded-2xl border border-fg/[0.07] bg-card px-3.5 py-3 text-left transition-colors hover:border-fg/15 active:bg-surface-subtle"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-interactive text-fg">
        <Icon name="caseMinimalistic" filled className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-fg">Services You Might Need</span>
        <span className="block truncate text-[12px] text-muted">From tutoring to repairs, find trusted services nearby.</span>
      </span>
      <span className={`inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-4 text-[13px] font-bold ${BTN_WHITE}`}>
        Explore <span aria-hidden>→</span>
      </span>
    </button>
  );
}

/* ───────────────────────────── States ───────────────────────────── */

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// Rows only: the banner is mounted by the screen itself, so it never waits for data.
function HomeSkeleton() {
  return (
    <div className="space-y-7" aria-hidden="true">
      {[0, 1].map((r) => (
        <div key={r}>
          <Sk className="mb-3 h-6 w-48 rounded-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`min-w-0 ${i >= 4 ? "hidden md:block" : ""}`}>
                <CardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Sk className="h-[70px] w-full rounded-2xl" />
    </div>
  );
}

function Message({ title, body, action }: { title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="grid place-items-center px-6 py-24 text-center">
      <div>
        <p className="text-[15px] font-bold text-fg">{title}</p>
        <p className="mt-1 text-secondary text-muted">{body}</p>
        {action && (
          <button type="button" onClick={action.onClick} className={`mt-5 h-10 rounded-full px-5 text-secondary font-extrabold ${BTN_YELLOW}`}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Screen ───────────────────────────── */

// Remembered across leaving and coming back to the screen. Changed only through remember(), which lives outside
// the component, so no render-time code ever reassigns module state.
interface Remembered {
  type: string;
  sort: SortId;
  grid: boolean;
  home: HomeData | null;
}
const mem: Remembered = { type: "", sort: "relevance", grid: false, home: null };
function remember(patch: Partial<Remembered>) {
  Object.assign(mem, patch);
}

export function MarketView() {
  useRenders("MarketView");
  const router = useRouter();
  const { status } = useAuth();
  const authed = status === "authed";
  const [type, setTypeState] = useState(() => mem.type);
  const [sort, setSortState] = useState<SortId>(() => mem.sort);
  const [gridMode, setGridMode] = useState(() => mem.grid);
  const [reloadTick, setReloadTick] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [home, setHome] = useState<HomeData | null>(() => mem.home);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const moreBusy = useRef(false);
  const moreAc = useRef<AbortController | null>(null);
  const pageRef = useRef<Page | null>(null);
  const isHome = !gridMode && type === "";
  const key = `${type}|${sort}|${reloadTick}`;
  const cur = page && page.key === key ? page : null;

  useEffect(() => {
    pageRef.current = page;
  });

  // The marketplace needs a signed-in user (the backend requires it), same as Discover.
  useEffect(() => {
    if (status === "guest") {
      remember({ home: null });
      openAuth();
    }
  }, [status]);

  // Home: trending + fresh. Cached copy renders instantly, the refresh reconciles silently.
  useEffect(() => {
    if (!authed || !isHome) return;
    const ac = new AbortController();
    Promise.all([fetchPage("", "relevance", null, ac.signal), fetchPage("", "newest", null, ac.signal)])
      .then(([t, f]) => {
        if (ac.signal.aborted) return;
        const trending = t.items.slice(0, 6);
        const seen = new Set(trending.map((p) => p.id));
        const fresh = f.items.filter((p) => !seen.has(p.id)).slice(0, 6);
        const next: HomeData = { trending, fresh, noCampus: t.noCampus || f.noCampus, error: null };
        remember({ home: next });
        setHome(next);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        const msg = e instanceof ApiError ? e.message : "Something went wrong.";
        setHome((prev) => (prev && prev.trending.length > 0 ? prev : { trending: [], fresh: [], noCampus: false, error: msg }));
      });
    return () => ac.abort();
  }, [authed, isHome, reloadTick]);

  // Grid: full list for a type / sort, paged.
  useEffect(() => {
    if (!authed || isHome) return;
    const ac = new AbortController();
    moreBusy.current = false;
    fetchPage(type, sort, null, ac.signal)
      .then((r) => !ac.signal.aborted && setPage({ key, ...r, loadingMore: false, error: null }))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setPage({ key, items: [], cursor: null, hasMore: false, noCampus: false, loadingMore: false, error: e instanceof ApiError ? e.message : "Something went wrong." });
      });
    return () => {
      ac.abort();
      moreAc.current?.abort(); // a late "next page" must never land on a different type / sort
      moreBusy.current = false;
    };
  }, [authed, isHome, type, sort, key]);

  // Next page. Results are applied only if the page is still the one the request was made for.
  const loadMore = useCallback(() => {
    if (moreBusy.current) return;
    const c = pageRef.current;
    if (!c || c.key !== key || !c.cursor) return;
    moreBusy.current = true;
    setPage((p) => (p && p.key === key ? { ...p, loadingMore: true, error: null } : p));
    const ac = new AbortController();
    moreAc.current = ac;
    fetchPage(type, sort, c.cursor, ac.signal)
      .then((r) => {
        if (ac.signal.aborted) return;
        // Trending ranks on live engagement, so a row can drift between pages; never show one twice.
        setPage((p) => {
          if (!p || p.key !== key) return p;
          const seen = new Set(p.items.map((x) => x.id));
          return { ...p, items: [...p.items, ...r.items.filter((x) => !seen.has(x.id))], cursor: r.cursor, hasMore: r.hasMore, loadingMore: false };
        });
      })
      .catch(() => {
        if (!ac.signal.aborted) setPage((p) => (p && p.key === key ? { ...p, loadingMore: false, error: "more" } : p));
      })
      .finally(() => {
        if (moreAc.current === ac) moreBusy.current = false;
      });
  }, [key, type, sort]);

  // Observe the sentinel well before the fold. A failed load does not recreate the observer, so it cannot loop.
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = cur?.hasMore ?? false;
  const cursor = cur?.cursor ?? null;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, cursor, loadMore]);

  // Close the sort menu on outside tap.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: PointerEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [sortOpen]);

  // Bring the tapped chip to the middle of the row.
  function centerChip(btn: HTMLElement) {
    const row = chipsRef.current;
    if (!row) return;
    const b = btn.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    row.scrollBy({ left: b.left + b.width / 2 - (r.left + r.width / 2), behavior: window.matchMedia(RM).matches ? "auto" : "smooth" });
  }

  function pickType(t: string) {
    remember({ type: t });
    setTypeState(t);
    if (t === "") {
      // "All" returns to the home layout.
      remember({ grid: false, sort: "relevance" });
      setGridMode(false);
      setSortState("relevance");
    }
  }
  function showAll(s: SortId) {
    remember({ type: "", sort: s, grid: true });
    setTypeState("");
    setSortState(s);
    setGridMode(true);
  }
  function pickSort(s: SortId) {
    setSortOpen(false);
    if (isHome) return showAll(s);
    remember({ sort: s });
    setSortState(s);
  }
  function sell() {
    if (!authed) return openAuth();
    router.push("/create/new?mode=listing");
  }
  function bannerAction(a: BannerAction) {
    if (a === "sell") return sell();
    if (a === "services") return pickType("service");
    showAll("relevance");
  }

  // The banner lives outside the keyed body below, so it mounts at once and survives loading -> content.
  let body: React.ReactNode;
  let bodyKey = "sk";
  let showBanner = false;
  if (isHome) {
    showBanner = true;
    if (!authed || !home) {
      body = <HomeSkeleton />;
    } else if (home.noCampus) {
      showBanner = false;
      bodyKey = "msg";
      body = (
        <Message
          title="Set your campus to shop"
          body="The marketplace shows listings from people on your campus."
          action={{ label: "Set my campus", onClick: () => router.push("/settings/campus") }}
        />
      );
    } else if (home.error && home.trending.length === 0) {
      showBanner = false;
      bodyKey = "msg";
      body = <Message title="Couldn't load the marketplace" body={home.error} action={{ label: "Try again", onClick: () => setReloadTick((n) => n + 1) }} />;
    } else {
      bodyKey = "home";
      body = (
        <div className="space-y-7">
          {home.trending.length === 0 ? (
            <Message title="No listings on your campus yet" body="Be the first to sell something." action={{ label: "Sell something", onClick: sell }} />
          ) : (
            <section>
              <SectionHead icon="fire" title="Trending around Campus" onSeeAll={() => showAll("relevance")} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {home.trending.map((p, i) => (
                  <div key={p.id} className={`min-w-0 ${i >= 4 ? "hidden md:block" : ""}`}>
                    <MarketCard post={p} priority={i < 2} />
                  </div>
                ))}
              </div>
            </section>
          )}
          {home.fresh.length > 0 && (
            <section>
              <SectionHead icon="bag2" title="Fresh on Anaija" onSeeAll={() => showAll("newest")} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {home.fresh.map((p, i) => (
                  <div key={p.id} className={`min-w-0 ${i >= 4 ? "hidden md:block" : ""}`}>
                    <MarketCard post={p} />
                  </div>
                ))}
              </div>
            </section>
          )}
          <ServicesStrip onExplore={() => pickType("service")} />
        </div>
      );
    }
  } else if (!authed || !cur) {
    body = <GridSkeleton />;
  } else if (cur.noCampus) {
    bodyKey = "msg";
    body = (
      <Message
        title="Set your campus to shop"
        body="The marketplace shows listings from people on your campus."
        action={{ label: "Set my campus", onClick: () => router.push("/settings/campus") }}
      />
    );
  } else if (cur.error && cur.items.length === 0) {
    bodyKey = "msg";
    body = <Message title="Couldn't load the marketplace" body={cur.error} action={{ label: "Try again", onClick: () => setReloadTick((n) => n + 1) }} />;
  } else if (cur.items.length === 0) {
    bodyKey = "msg";
    body = (
      <Message
        title="No listings on your campus yet"
        body={type ? "Nothing in this category yet. Try All." : "Be the first to sell something."}
        action={type ? { label: "Show all", onClick: () => pickType("") } : { label: "Sell something", onClick: sell }}
      />
    );
  } else {
    bodyKey = `grid|${type}|${sort}`;
    const typeLabel = TYPES.find((t) => t.id === type)?.label ?? "All listings";
    const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? "";
    body = (
      <>
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-[18px] font-extrabold tracking-tight text-fg">{typeLabel}</h2>
          <span className="text-[12px] font-semibold text-muted">{sortLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {cur.items.map((p, i) => (
            <MarketCard key={p.id} post={p} priority={i < 4} />
          ))}
        </div>
        <div ref={sentinel} className="h-px" />
        {cur.loadingMore ? (
          <MoreSkeleton />
        ) : cur.error ? (
          <div className="grid h-14 place-items-center">
            <button
              type="button"
              onClick={loadMore}
              className="h-9 rounded-full border border-fg/10 bg-surface-subtle px-4 text-[13px] font-bold text-fg transition-colors active:bg-surface-interactive"
            >
              Retry loading more
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pb-8 md:px-4">
      <header className="sticky top-0 z-30 bg-bg" style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between pb-3 pl-1 md:pt-4">
          <h1 className="text-[28px] font-extrabold tracking-tight text-fg">Marketplace</h1>
          <button
            type="button"
            onClick={sell}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-fg/10 bg-surface-interactive px-4 text-[15px] font-extrabold text-fg transition-transform active:scale-95 motion-reduce:active:scale-100"
          >
            <Icon name="plus" weight="strong" className="size-[18px]" />
            Sell
          </button>
        </div>
        <div className="flex items-center gap-2 pb-3">
          <Link
            href="/search"
            aria-label="Search listings"
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-fg/10 bg-surface-subtle px-4 text-muted transition-colors hover:bg-surface-interactive active:bg-surface-interactive"
          >
            <Icon name="search" className="size-[20px] shrink-0" />
            <span className="truncate text-body">Search for products, services...</span>
          </Link>
          <div ref={sortRef} className="relative shrink-0">
            <button
              type="button"
              aria-label="Sort listings"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((o) => !o)}
              className="grid size-12 place-items-center rounded-full border border-fg/10 bg-surface-subtle text-fg transition-colors hover:bg-surface-interactive active:bg-surface-interactive"
            >
              <Icon name="tuning2" className="size-[22px]" />
            </button>
            {sortOpen && (
              <div className="mk-pop absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-fg/10 bg-card-elevated p-1 shadow-2xl">
                {SORTS.map((s) => {
                  const on = !isHome && sort === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickSort(s.id)}
                      className={`flex h-10 w-full items-center justify-between rounded-xl px-3 text-[14px] font-semibold transition-colors hover:bg-fg/5 active:bg-fg/5 ${
                        on ? TEXT_YELLOW : "text-fg"
                      }`}
                    >
                      {s.label}
                      {on && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div ref={chipsRef} className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 pb-3 md:mx-0 md:px-0">
          {TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button
                key={t.id || "all"}
                type="button"
                onClick={(e) => {
                  pickType(t.id);
                  centerChip(e.currentTarget);
                }}
                aria-pressed={on}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-bold transition-[background-color,color,transform] active:scale-95 motion-reduce:active:scale-100 ${
                  on ? BTN_WHITE : "border border-fg/10 bg-surface-subtle text-fg hover:bg-surface-interactive"
                }`}
              >
                {t.icon && <Icon name={t.icon} tone="none" className="size-[18px]" />}
                {t.label}
              </button>
            );
          })}
        </div>
      </header>
      <div className="pt-1">
        {showBanner && (
          <div className="mb-7">
            <Banner onAction={bannerAction} />
          </div>
        )}
        <div key={bodyKey} className="mk-in">
          {body}
        </div>
      </div>
    </div>
  );
}
