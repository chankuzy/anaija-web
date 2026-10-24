"use client";

import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DiscoverGrid, DiscoverSkeleton } from "@/components/discover/discover-grid";
import { PostViewer } from "@/components/discover/post-viewer";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { searchApi, type SearchUser, type Suggestion, type SuggestionsRes } from "@/lib/api/search";
import { useAuth } from "@/lib/auth/auth-context";
import { onCacheClear, useCached } from "@/lib/cache/swr";
import { formatCount } from "@/lib/format";
import {
  addRecent,
  clearRecents,
  parseRecents,
  recentsServerSnapshot,
  recentsSnapshot,
  recentsSubscribe,
  removeRecent,
} from "@/lib/search/recents";

type Tab = "top" | "people" | "posts" | "listings";
const TABS: { id: Tab; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "people", label: "People" },
  { id: "posts", label: "Posts" },
  { id: "listings", label: "Listings" },
];
interface Results {
  q: string;
  users: SearchUser[];
  posts: Post[];
  listings: Post[];
}

// Where you were survives leaving Search (tap a person, press back: same query, tab and scroll), and repeat
// queries are instant. Memory only (searches are personal), wiped on sign-out / account change.
const memo = { q: "", tab: "top" as Tab, scroll: 0 };
const resultCache = new Map<string, { at: number; data: Results }>();
const RESULT_TTL = 60_000;
const RESULT_MAX = 30;
onCacheClear(() => {
  resultCache.clear();
  memo.q = "";
  memo.tab = "top";
  memo.scroll = 0;
});

const keyOf = (q: string) => q.trim().toLowerCase();
const same = (a: string, b: string) => keyOf(a) === keyOf(b);

function cachePut(data: Results) {
  const k = keyOf(data.q);
  resultCache.delete(k);
  resultCache.set(k, { at: Date.now(), data });
  while (resultCache.size > RESULT_MAX) {
    const oldest = resultCache.keys().next().value;
    if (oldest === undefined) break;
    resultCache.delete(oldest);
  }
}

const toItems = (posts: Post[], kind: "post" | "listing"): DiscoverItem[] =>
  posts.map((p) => ({ id: `${kind}${p.id}`, kind, post: p, src: null, slot: 0 }));

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <b className="font-extrabold text-fg">{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-3 flex items-center">
      <h2 className="flex-1 text-section font-bold tracking-tight text-fg">{children}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className="text-secondary font-semibold text-muted">
          {action.label}
        </button>
      )}
    </div>
  );
}

function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="grid place-items-center px-6 py-24 text-center">
      <div>
        <p className="text-[15px] font-bold text-fg">{title}</p>
        {sub && <p className="mt-1 text-secondary text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export function SearchView() {
  const router = useRouter();
  const { status } = useAuth();
  const authed = status === "authed";
  const [q, setQ] = useState(() => memo.q);
  const [tab, setTab] = useState<Tab>(() => memo.tab);
  const [ac, setAc] = useState<{ q: string; items: Suggestion[] } | null>(null);
  const [latest, setLatest] = useState<Results | null>(() => resultCache.get(keyOf(memo.q))?.data ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ items: DiscoverItem[]; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedEmpty = useRef(q.trim() === "");

  // Trending / popular: instant from cache, quietly refreshed.
  const { data: landing } = useCached<SuggestionsRes>(authed ? "search:landing" : null, () => searchApi.suggestions(""), {
    staleMs: 5 * 60_000,
  });

  const rawRecents = useSyncExternalStore(recentsSubscribe, recentsSnapshot, recentsServerSnapshot);
  const recents = useMemo(() => parseRecents(rawRecents), [rawRecents]);

  const setQuery = useCallback((v: string) => {
    memo.q = v;
    memo.scroll = 0;
    setQ(v);
  }, []);
  const changeTab = useCallback((t: Tab) => {
    memo.tab = t;
    setTab(t);
  }, []);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);
  // Only pop the keyboard on a fresh search, not when coming back to results.
  useEffect(() => {
    if (startedEmpty.current) inputRef.current?.focus();
  }, []);

  // One character -> autocomplete; two or more -> full search (debounced; a newer keystroke aborts the older
  // request). A query searched in the last minute is served from memory with no request at all.
  useEffect(() => {
    const t = q.trim();
    if (!authed || t.length === 0) return;
    const hit = resultCache.get(keyOf(t));
    if (t.length >= 2 && hit && Date.now() - hit.at < RESULT_TTL) return;
    const ac$ = new AbortController();
    const id = window.setTimeout(
      () => {
        if (t.length < 2) {
          searchApi
            .suggestions(t, ac$.signal)
            .then((r) => setAc({ q: t, items: r.suggestions }))
            .catch(() => {});
        } else {
          searchApi
            .all(t, ac$.signal)
            .then((r) => {
              const res: Results = { q: t, ...r };
              cachePut(res);
              setLatest(res);
              setFailed(null);
            })
            .catch(() => {
              if (!ac$.signal.aborted) setFailed(t);
            });
        }
      },
      t.length < 2 ? 120 : 350,
    );
    return () => {
      window.clearTimeout(id);
      ac$.abort();
    };
  }, [q, authed]);

  const runTerm = useCallback(
    (term: string) => {
      setQuery(term);
      changeTab("top");
      addRecent(term);
    },
    [setQuery, changeTab],
  );

  const t = q.trim();
  const hasQuery = t.length >= 2;
  const hit = hasQuery ? resultCache.get(keyOf(t)) : undefined;
  const results: Results | null = latest && same(latest.q, t) ? latest : (hit?.data ?? latest);
  const stale = hasQuery && results !== null && !same(results.q, t);

  const mapResults = useCallback((fn: (r: Results) => Results) => {
    setLatest((r) => (r ? fn(r) : r));
    for (const [k, e] of resultCache) resultCache.set(k, { ...e, data: fn(e.data) });
  }, []);
  const patchPost = useCallback(
    (id: number, p: Partial<Post>) =>
      mapResults((r) => ({
        ...r,
        posts: r.posts.map((x) => (x.id === id ? { ...x, ...p } : x)),
        listings: r.listings.map((x) => (x.id === id ? { ...x, ...p } : x)),
      })),
    [mapResults],
  );
  const removePost = useCallback(
    (id: number) => mapResults((r) => ({ ...r, posts: r.posts.filter((x) => x.id !== id), listings: r.listings.filter((x) => x.id !== id) })),
    [mapResults],
  );

  // Remember scroll while a query is showing; restore it once when coming back to results.
  useEffect(() => {
    const onScroll = () => {
      if (memo.q.trim().length >= 2) memo.scroll = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const restored = useRef(false);
  const hasResults = results !== null;
  useLayoutEffect(() => {
    if (restored.current || !hasResults) return;
    restored.current = true;
    if (memo.scroll > 0) window.scrollTo({ top: memo.scroll });
  }, [hasResults]);

  const open = (items: DiscoverItem[], index: number) => {
    addRecent(t);
    setViewer({ items, index });
  };

  let body: React.ReactNode;
  if (t.length === 0) {
    const tags = landing?.trending_hashtags ?? [];
    const terms = landing?.trending_terms ?? [];
    const max = Math.max(1, ...tags.map((h) => h.posts_count));
    body = (
      <div className="space-y-7 px-5 pb-10 pt-1">
        {recents.length > 0 && (
          <section>
            <SectionTitle action={{ label: "Clear all", onClick: clearRecents }}>Recent</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {recents.slice(0, 8).map((r) => (
                <span key={r} className="flex items-center rounded-full border border-white/12 bg-white/6 pl-3 text-body text-fg">
                  <button type="button" onClick={() => runTerm(r)} className="max-w-[170px] truncate py-1.5 font-medium">
                    {r}
                  </button>
                  <button type="button" aria-label={`Remove ${r}`} onClick={() => removeRecent(r)} className="grid size-8 place-items-center text-muted relative hit-area">
                    <Icon name="close" className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}
        {terms.length > 0 && (
          <section>
            <SectionTitle>Popular searches</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {terms.map((x) => (
                <button key={x} type="button" onClick={() => runTerm(x)} className="rounded-full border border-white/12 bg-white/6 px-3.5 py-2 text-secondary text-fg">
                  {x}
                </button>
              ))}
            </div>
          </section>
        )}
        {tags.length > 0 && (
          <section>
            <SectionTitle>Trending on campus</SectionTitle>
            {tags.slice(0, 8).map((h, i) => (
              <button key={h.tag} type="button" onClick={() => runTerm(h.tag)} className="flex w-full items-center py-2.5 text-left">
                <span className="w-12 text-[28px] font-medium leading-none text-white/25">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-label font-bold text-fg">#{h.tag}</span>
                    <span className="text-supporting text-muted">{formatCount(h.posts_count)} posts</span>
                  </span>
                  <span className="mt-2 block h-0.5 rounded bg-white/8">
                    <span className="block h-full rounded bg-white/60" style={{ width: `${Math.max(5, (h.posts_count / max) * 100)}%` }} />
                  </span>
                </span>
              </button>
            ))}
          </section>
        )}
        {recents.length === 0 && tags.length === 0 && terms.length === 0 && (
          <p className="text-body leading-snug text-muted">People, posts, listings and businesses, all in one place.</p>
        )}
      </div>
    );
  } else if (!hasQuery) {
    const items = ac && ac.q === t ? ac.items : [];
    body = (
      <div className="px-5 pb-6">
        {items.map((s) => {
          const isUser = s.type === "user";
          const row = (
            <>
              {isUser ? (
                <Avatar url={s.avatar} name={s.name ?? s.value} size={42} />
              ) : (
                <span className="grid size-[42px] place-items-center rounded-full border border-white/12 bg-white/6 text-lg font-bold text-fg">#</span>
              )}
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px] font-semibold text-fg/60">{highlight(isUser ? (s.name ?? s.value) : `#${s.value}`, t)}</span>
                <span className="block text-xs text-muted">{isUser ? `@${s.value}` : `${formatCount(s.posts_count ?? 0)} posts`}</span>
              </span>
            </>
          );
          return isUser ? (
            <Link key={`u${s.value}`} href={`/u/${s.value}`} className="flex items-center gap-3 py-2.5">
              {row}
            </Link>
          ) : (
            <button key={`h${s.value}`} type="button" onClick={() => runTerm(s.value)} className="flex w-full items-center gap-3 py-2.5">
              {row}
            </button>
          );
        })}
      </div>
    );
  } else if (!results) {
    body =
      failed === t ? <Empty title="Couldn't search" sub="Check your connection and try again" /> : <DiscoverSkeleton />;
  } else if (results.users.length + results.posts.length + results.listings.length === 0 && !stale) {
    body = <Empty title={`No results for "${t}"`} sub="Try a different word or check the spelling" />;
  } else {
    const postItems = toItems(results.posts, "post");
    const listingItems = toItems(results.listings, "listing");
    const mixed: DiscoverItem[] = [];
    for (let i = 0; i < Math.max(postItems.length, listingItems.length); i++) {
      if (postItems[i]) mixed.push(postItems[i]);
      if (listingItems[i]) mixed.push(listingItems[i]);
    }
    const grid = (items: DiscoverItem[], empty: string) =>
      items.length === 0 ? <Empty title={empty} /> : <DiscoverGrid items={items} onOpen={(i) => open(items, i)} />;

    if (tab === "people") {
      body =
        results.users.length === 0 ? (
          <Empty title="No people found" />
        ) : (
          <div className="px-5 pb-10">
            {results.users.map((u) => (
              <Link key={u.id} href={`/u/${u.username}`} onClick={() => addRecent(t)} className="flex items-center gap-3 py-2.5">
                <ProfileHoverCard username={u.username}><Avatar url={u.avatar} name={u.name ?? u.username} size={48} /></ProfileHoverCard>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-fg">{u.name ?? u.username}</span>
                  <span className="block text-xs text-muted">@{u.username}</span>
                </span>
                <span className="rounded-full border border-white/28 px-3.5 py-1.5 text-secondary font-bold text-fg">View</span>
              </Link>
            ))}
          </div>
        );
    } else if (tab === "posts") {
      body = grid(postItems, "No posts found");
    } else if (tab === "listings") {
      body = grid(listingItems, "No listings found");
    } else {
      body = (
        <>
          {results.users.length > 0 && (
            <div className="px-5 pb-5">
              <SectionTitle action={{ label: "See all", onClick: () => changeTab("people") }}>People</SectionTitle>
              <div className="no-scrollbar flex gap-3.5 overflow-x-auto">
                {results.users.map((u) => (
                  <Link key={u.id} href={`/u/${u.username}`} onClick={() => addRecent(t)} className="w-[72px] shrink-0 text-center">
                    <span className="mx-auto block w-fit rounded-full border border-white/22 p-0.5">
                      <ProfileHoverCard username={u.username}><Avatar url={u.avatar} name={u.name ?? u.username} size={54} /></ProfileHoverCard>
                    </span>
                    <span className="mt-1.5 block truncate text-supporting font-semibold text-fg">{u.name ?? u.username}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {mixed.length > 0 && <h2 className="px-5 pb-3 text-[15px] font-bold text-fg">Posts &amp; listings</h2>}
          {grid(mixed, "No posts or listings found")}
        </>
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] pb-6">
      <header className="sticky top-0 z-30 bg-bg px-3.5 pb-2" style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2.5 py-1">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.back()}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/12 bg-white/6 text-fg"
          >
            <Icon name="back" className="size-5" />
          </button>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-3xl border border-white/12 bg-white/6 pl-4 pr-1.5 focus-within:border-white/34 focus-within:bg-white/9">
            <Icon name="search" className="size-[19px] shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addRecent(q);
                  e.currentTarget.blur();
                }
              }}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Search people, posts, listings..."
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-fg outline-none placeholder:text-body placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => {
                  setQuery("");
                  changeTab("top");
                  inputRef.current?.focus();
                }}
                className="grid size-9 place-items-center"
              >
                <span className="grid size-[22px] place-items-center rounded-full bg-white/18 text-white">
                  <Icon name="close" className="size-3.5" />
                </span>
              </button>
            )}
          </div>
        </div>
        {hasQuery && (
          <div className="mt-2 flex gap-0.5 rounded-full border border-white/10 bg-white/5 p-[3px]">
            {TABS.map((x) => {
              const n = !results ? 0 : x.id === "people" ? results.users.length : x.id === "posts" ? results.posts.length : x.id === "listings" ? results.listings.length : 0;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => changeTab(x.id)}
                  className={`flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full text-body ${
                    x.id === tab ? "border border-white/26 bg-white/15 font-bold text-fg" : "font-medium text-white/60"
                  }`}
                >
                  {x.label}
                  {n > 0 && <span className="text-micro font-semibold text-white/40">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className={`mt-1.5 h-0.5 overflow-hidden rounded bg-transparent transition-opacity ${stale ? "opacity-100" : "opacity-0"}`}>
          <div className="h-full w-1/3 animate-pulse rounded bg-white/60" />
        </div>
      </header>

      {body}

      {viewer && (
        <PostViewer items={viewer.items} startIndex={viewer.index} onClose={() => setViewer(null)} onPatch={patchPost} onRemove={removePost} />
      )}
    </div>
  );
}
