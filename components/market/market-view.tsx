/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { MoreSkeleton, Sk } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { normPost } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { openAuth } from "@/lib/auth/auth-modal";
import { coverOf } from "@/lib/discover/tile";
import { formatCompactLocation } from "@/lib/location/types";

const TYPES: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "product", label: "Products" },
  { id: "service", label: "Services" },
  { id: "rental", label: "Rentals" },
  { id: "business", label: "Businesses" },
  { id: "wanted", label: "Wanted" },
];
// Only the sorts the backend can page through (price sorts ignore the cursor server-side).
const SORTS = [
  { id: "relevance", label: "Trending" },
  { id: "newest", label: "Newest" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

const COND: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };
const PREFIX: Record<string, string> = { service: "From", business: "From", wanted: "Budget" };

interface Raw {
  listings?: Post[];
  next_cursor?: string | null;
  has_more?: boolean;
}
interface Page {
  key: string;
  items: Post[];
  cursor: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
}

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
  };
}

function MarketCard({ post }: { post: Post }) {
  const [failed, setFailed] = useState(false);
  const d = post.listing;
  const type = post.listing_type ?? "product";
  const cover = coverOf(post);
  const title = ((type === "business" ? d?.business_name : null) || post.caption || "").trim();
  const where = d?.location_info ? formatCompactLocation(d.location_info) : (d?.pickup_info || post.location || "");
  const cond = d?.condition ? COND[d.condition] : null;
  const prefix = PREFIX[type];
  return (
    <Link href={`/l/${post.id}`} className="group block min-w-0">
      <div
        className="relative aspect-square overflow-hidden rounded-2xl bg-card"
        style={{ backgroundColor: cover.color ?? undefined }}
      >
        {cover.url && !failed ? (
          <img
            src={cover.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#26211c,#141416)] text-white/35">
            <Icon name="bag" filled className="size-9" />
          </span>
        )}
        {d?.price_type === "negotiable" && (
          <span className="absolute left-2 top-2 rounded-pill bg-black/65 px-2 py-0.5 text-micro font-bold text-white">Nego</span>
        )}
      </div>
      <div className="px-0.5 pt-2">
        {d && (
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-[17px] font-extrabold leading-tight tracking-tight text-fg">
            {prefix && <span className="text-secondary font-medium text-muted">{prefix}</span>}
            <span>
              <span className="mr-0.5 text-brand">₦</span>
              {d.formatted_price}
            </span>
          </p>
        )}
        {title && <p className="mt-0.5 line-clamp-2 text-body leading-snug text-fg">{title}</p>}
        {(cond || where) && (
          <p className="mt-1 flex items-center gap-1 text-supporting text-muted">
            {cond && <span className="shrink-0">{cond}</span>}
            {cond && where && <span aria-hidden>·</span>}
            {where && <span className="truncate">{where}</span>}
          </p>
        )}
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>
          <Sk className="aspect-square w-full rounded-2xl" />
          <Sk className="mt-2.5 h-4 w-20 rounded-full" />
          <Sk className="mt-2 h-3.5 w-[80%] rounded-full" />
        </div>
      ))}
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
          <button type="button" onClick={action.onClick} className="mt-5 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg">
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Remembered across leaving and coming back to the screen.
let rememberedType = "";
let rememberedSort: SortId = "relevance";

export function MarketView() {
  const { status } = useAuth();
  const authed = status === "authed";
  const [type, setTypeState] = useState(() => rememberedType);
  const [sort, setSortState] = useState<SortId>(() => rememberedSort);
  const [reloadTick, setReloadTick] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const moreBusy = useRef(false);
  const key = `${type}|${sort}|${reloadTick}`;
  const cur = page && page.key === key ? page : null;

  // The marketplace needs a signed-in user (the backend requires it), same as Discover.
  useEffect(() => {
    if (status === "guest") openAuth();
  }, [status]);

  useEffect(() => {
    if (!authed) return;
    const ac = new AbortController();
    moreBusy.current = false;
    fetchPage(type, sort, null, ac.signal)
      .then((r) => !ac.signal.aborted && setPage({ key, ...r, loadingMore: false, error: null }))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setPage({ key, items: [], cursor: null, hasMore: false, loadingMore: false, error: e instanceof ApiError ? e.message : "Something went wrong." });
      });
    return () => ac.abort();
  }, [authed, type, sort, key]);

  // Next page well before the fold.
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = cur?.hasMore ?? false;
  const count = cur?.items.length ?? 0;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting || moreBusy.current) return;
        const c = cur;
        if (!c || !c.cursor) return;
        moreBusy.current = true;
        setPage({ ...c, loadingMore: true });
        const ac = new AbortController();
        fetchPage(type, sort, c.cursor, ac.signal)
          .then((r) => {
            const seen = new Set(c.items.map((p) => p.id));
            setPage({ ...c, items: [...c.items, ...r.items.filter((p) => !seen.has(p.id))], cursor: r.cursor, hasMore: r.hasMore, loadingMore: false });
          })
          .catch(() => setPage({ ...c, loadingMore: false }))
          .finally(() => {
            moreBusy.current = false;
          });
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, count, cur, type, sort]);

  function setType(t: string) {
    rememberedType = t;
    setTypeState(t);
  }
  function setSort(s: SortId) {
    rememberedSort = s;
    setSortState(s);
  }
  function sell() {
    if (!authed) return openAuth();
    window.dispatchEvent(new Event("anaija:create"));
  }

  let body: React.ReactNode;
  if (!authed || !cur) {
    body = <GridSkeleton />;
  } else if (cur.error && cur.items.length === 0) {
    body = <Message title="Couldn't load the marketplace" body={cur.error} action={{ label: "Try again", onClick: () => setReloadTick((n) => n + 1) }} />;
  } else if (cur.items.length === 0) {
    body = (
      <Message
        title="No listings here yet"
        body={type ? "Try another category." : "Be the first to sell something."}
        action={type ? { label: "Show all", onClick: () => setType("") } : { label: "Sell something", onClick: sell }}
      />
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 xl:grid-cols-4">
          {cur.items.map((p) => (
            <MarketCard key={p.id} post={p} />
          ))}
        </div>
        <div ref={sentinel} className="h-px" />
        {cur.loadingMore && <MoreSkeleton />}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pb-8 md:px-4">
      <header className="sticky top-0 z-30 bg-bg/95" style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2 pb-3 md:pt-4">
          <h1 className="shrink-0 text-[22px] font-extrabold tracking-tight text-fg">Marketplace</h1>
          <Link
            href="/search"
            aria-label="Search listings"
            className="ml-2 flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface-subtle px-4 text-muted transition-colors hover:bg-surface-interactive md:max-w-[460px]"
          >
            <Icon name="search" className="size-[18px] shrink-0" />
            <span className="truncate text-body">Search listings...</span>
          </Link>
          <button
            type="button"
            onClick={sell}
            className="ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-secondary font-extrabold text-brand-fg transition-transform active:scale-95"
          >
            <Icon name="plus" weight="strong" className="size-[18px]" />
            Sell
          </button>
        </div>
        <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-3 md:mx-0 md:px-0">
          {TYPES.map((t) => (
            <button
              key={t.id || "all"}
              type="button"
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={`h-9 shrink-0 rounded-full px-4 text-secondary font-bold transition-colors ${
                type === t.id ? "bg-fg text-bg" : "bg-surface-interactive text-fg hover:bg-surface-elevated"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-white/15" aria-hidden />
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={`h-9 shrink-0 rounded-full px-3.5 text-secondary font-semibold transition-colors ${
                sort === s.id ? "text-fg underline decoration-brand decoration-2 underline-offset-[6px]" : "text-white/70 hover:text-fg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>
      <div className="pt-1">{body}</div>
    </div>
  );
}
