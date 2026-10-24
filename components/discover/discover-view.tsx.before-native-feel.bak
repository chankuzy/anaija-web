"use client";
import { MoreSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiscoverFilter, DiscoverItem } from "@/lib/api/discover";
import { useAuth } from "@/lib/auth/auth-context";
import { useDiscover } from "@/lib/discover/use-discover";
import { DiscoverGrid, DiscoverSkeleton } from "./discover-grid";
import { CheckGlyph, ChevronDownGlyph, RefreshGlyph, SearchGlyph } from "./glyphs";
import { PostViewer } from "./post-viewer";

const FILTERS: { id: DiscoverFilter; label: string }[] = [
  { id: "for_you", label: "For You" },
  { id: "marketplace", label: "Marketplace" },
];

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
        className="flex h-9 items-center gap-1 rounded-full bg-white/8 px-3.5 text-secondary font-semibold text-fg transition-colors hover:bg-white/14"
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
          <button type="button" onClick={action.onClick} className="mt-5 h-10 rounded-full bg-white px-5 text-secondary font-bold text-black">
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
  const [filter, setFilter] = useState<DiscoverFilter>("for_you");
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; index: number } | null>(null);
  const { view, loading, reload, maybeLoadMore, patchPost, removePost } = useDiscover({
    enabled: authed,
    userId: user?.id ?? 0,
    filter,
  });

  // Discover needs a signed-in user (the backend requires it), same as Flutter's tab rule.
  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  const items = view?.items ?? [];
  const hasMore = view?.hasMore ?? false;
  const loadingMore = view?.loadingMore ?? false;

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
    setFilter(f);
    window.scrollTo({ top: 0 });
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
        <div className={`transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}>
          <DiscoverGrid items={items} onOpen={(i) => setViewer({ items, index: i })} />
        </div>
        <div ref={sentinel} className="h-px" />
        {loadingMore && <MoreSkeleton />}
        {!hasMore && !loading && !view?.fromCache && (
          <div className="px-6 pb-4 pt-7 text-center text-secondary text-muted">
            That&apos;s everything for now.
            <button type="button" onClick={reload} className="ml-1 font-semibold text-fg underline-offset-2 hover:underline">
              Refresh
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[935px] px-0 pb-6 md:px-4">
      <header
        className="sticky top-0 z-30 -mx-0 flex items-center justify-center gap-2 bg-bg/80 px-3 pb-3 pt-2 backdrop-blur-xl md:px-0 md:pb-5 md:pt-6"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-white/10 bg-white/7 pl-4 pr-1.5 transition-colors focus-within:border-white/25 hover:bg-white/9 md:max-w-[560px]">
          <Link href="/search" className="flex min-w-0 flex-1 items-center gap-2.5 text-muted">
            <SearchGlyph className="size-[18px] shrink-0" />
            <span className="truncate text-body">Search people, posts, listings...</span>
          </Link>
          <FilterMenu value={filter} onChange={selectFilter} />
        </div>
        <button
          type="button"
          onClick={reload}
          aria-label="Refresh"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/7 text-fg transition-colors hover:bg-white/12"
        >
          <RefreshGlyph className={`size-[18px] ${loading && view ? "animate-spin" : ""}`} />
        </button>
      </header>

      {view?.notice && (
        <p className="px-3 pb-2 text-center text-xs font-semibold text-muted">{view.notice}</p>
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
