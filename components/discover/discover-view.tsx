"use client";
import { openAuth } from "@/lib/auth/auth-modal";
import { MoreSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscoverFilter, DiscoverItem } from "@/lib/api/discover";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscover } from "@/lib/discover/use-discover";
import { usePullRefresh } from "@/lib/ui/use-pull-refresh";
import { PullIndicator } from "@/components/ui/pull-indicator";
import { DiscoverGrid, DiscoverSkeleton } from "./discover-grid";
import { CheckGlyph, ChevronDownGlyph, RefreshGlyph, SearchGlyph } from "./glyphs";
import { PostViewer } from "./post-viewer";

const FILTERS: { id: DiscoverFilter; label: string }[] = [
  { id: "for_you", label: "For You" },
  { id: "marketplace", label: "Marketplace" },
];

// Survives leaving Discover and coming back: the chosen filter and where the viewer was scrolled to.
let rememberedFilter: DiscoverFilter = "for_you";
const scrollPos = new Map<string, number>();

function FilterMenu({ value, onChange }: { value: DiscoverFilter; onChange: (f: DiscoverFilter) => void }) {
  const [open, setOpen] = useState(false);
  const label = FILTERS.find((f) => f.id === value)?.label;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-1 rounded-full bg-surface-interactive px-3.5 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated"
      >
        {label}
        <ChevronDownGlyph className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="glass absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl py-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onChange(f.id);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-body font-semibold text-white transition-colors hover:bg-white/8"
              >
                {f.label}
                {f.id === value && <CheckGlyph className="size-4" />}
              </button>
            ))}
          </div>
        </>
      )}
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

export function DiscoverView() {
  const router = useRouter();
  const { status, user } = useAuth();
  const authed = status === "authed";
  const [filter, setFilterState] = useState<DiscoverFilter>(() => rememberedFilter);
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; index: number } | null>(null);
  const { view, loading, refreshing, reload, maybeLoadMore, patchPost, removePost } = useDiscover({
    enabled: authed,
    userId: user?.id ?? 0,
    filter,
  });

  const pr = usePullRefresh({ onRefresh: reload, enabled: authed && !viewer });

  // Discover needs a signed-in user (the backend requires it), same as Flutter's tab rule.
  useEffect(() => {
    if (status === "guest") openAuth();
  }, [status, router]);

  const items = view?.items ?? [];
  const hasMore = view?.hasMore ?? false;
  const loadingMore = view?.loadingMore ?? false;

  // Remember where the viewer was, per account + filter.
  const scrollKey = `${user?.id ?? 0}:${filter}`;
  useEffect(() => {
    const onScroll = () => scrollPos.set(scrollKey, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  // Coming back: jump (before paint) to where they left off.
  const restoredFor = useRef<string | null>(null);
  const hasItems = items.length > 0;
  useLayoutEffect(() => {
    if (!hasItems || restoredFor.current === scrollKey) return;
    restoredFor.current = scrollKey;
    const y = scrollPos.get(scrollKey) ?? 0;
    if (y > 0) window.scrollTo({ top: y });
  }, [hasItems, scrollKey]);

  // Load the next page well before the fold. Re-observing after each page re-fires if the sentinel is still near.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && maybeLoadMore(), { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, hasMore, loadingMore, maybeLoadMore]);

  function selectFilter(f: DiscoverFilter) {
    if (f === filter) return;
    rememberedFilter = f;
    setFilterState(f);
  }

  function refreshNow() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    reload();
  }

  let body: React.ReactNode;
  if (status !== "authed" || (loading && !view)) {
    body = <DiscoverSkeleton />;
  } else if (view && view.error && items.length === 0) {
    body = <Message title="Couldn't load Discover" body={view.error} action={{ label: "Try again", onClick: reload }} />;
  } else if (items.length === 0) {
    body = (
      <Message
        title={filter === "marketplace" ? "No listings yet" : "Nothing to discover yet"}
        body="Check back soon"
        action={{ label: "Refresh", onClick: reload }}
      />
    );
  } else {
    body = (
      <>
        <DiscoverGrid items={items} onOpen={(i) => setViewer({ items, index: i })} />
        <div ref={sentinel} className="h-px" />
        {loadingMore && <MoreSkeleton />}
        {!hasMore && !loading && !view?.fromCache && (
          <div className="px-6 pb-4 pt-7 text-center text-secondary text-muted">
            That&apos;s everything for now.
            <button type="button" onClick={refreshNow} className="ml-1 font-semibold text-fg underline-offset-2 hover:underline">
              Refresh
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[935px] px-0 pb-6 md:px-4">
      <PullIndicator pull={pr.pull} refreshing={pr.refreshing} />
      <header
        className="sticky top-0 z-30 -mx-0 bg-bg/95"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-center gap-2 px-3 pb-3 md:px-0 md:pb-5 md:pt-6">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-surface-subtle pl-4 pr-1.5 transition-colors hover:bg-surface-interactive md:max-w-[560px]">
            <Link href="/search" className="flex min-w-0 flex-1 items-center gap-2.5 text-muted">
              <SearchGlyph className="size-[18px] shrink-0" />
              <span className="truncate text-body">Search people, posts, listings...</span>
            </Link>
            <FilterMenu value={filter} onChange={selectFilter} />
          </div>
          <button
            type="button"
            onClick={refreshNow}
            aria-label="Refresh"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg transition-colors hover:bg-surface-interactive active:scale-95"
          >
            <RefreshGlyph className={`size-[18px] ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        {/* Silent background reconcile: a hairline, never a spinner over the content. */}
        <div className={`h-[2px] w-full bg-brand/40 transition-opacity duration-300 ${refreshing ? "animate-pulse opacity-100" : "opacity-0"}`} />
      </header>

      {view?.notice && (
        <p className="px-3 pb-2 pt-2 text-center text-xs font-semibold text-muted">{view.notice}</p>
      )}

      {body}

      {viewer && (
        <PostViewer
          items={viewer.items}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
          onPatch={patchPost}
          onRemove={removePost}
        />
      )}
    </div>
  );
}
