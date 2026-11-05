"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type Community } from "@/lib/api/communities";
import { homeApi } from "@/lib/api/community-home";
import { useAuth } from "@/lib/auth/auth-context";
import { addSearch, clearSearches, removeSearch, useSearches } from "@/lib/community/search-recents";
import { CATEGORIES, Chip, Cm, Empty, categoryLabel, useFetch } from "./kit";

type Extra = { key: string; items: Community[]; more: boolean; page: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const metaOf = (c: Community) => [categoryLabel(c.category), c.course_code, c.department, plural(c.members_count, "member", "members")].filter(Boolean).join(" · ");

function mark(text: string, q: string): ReactNode {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <b className="font-extrabold text-brand-ink">{text.slice(i, i + q.length)}</b>
      {text.slice(i + q.length)}
    </>
  );
}

function Row({ c, q, onOpen }: { c: Community; q: string; onOpen: () => void }) {
  const state = c.is_member ? "Joined" : c.request_status === "pending" ? "Requested" : c.join_policy === "open" ? "Open" : c.join_policy === "request" ? "Approval" : "Invite only";
  return (
    <Link href={`/c/${c.slug}`} onClick={onOpen} className="flex items-center gap-3 rounded-2xl px-1 py-2.5 transition-colors active:bg-surface-interactive">
      <Avatar url={c.avatar} name={c.name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-fg">{mark(c.name, q)}</span>
        <span className="mt-0.5 block truncate text-supporting text-muted">{metaOf(c)}</span>
      </span>
      <span className="shrink-0 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{state}</span>
    </Link>
  );
}

function RowsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Searching" className="space-y-3 pt-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-1.5">
          <Sk className="size-12 rounded-full" />
          <div className="flex-1 space-y-2"><Sk className="h-3.5 w-40 rounded-full" /><Sk className="h-3 w-56 rounded-full" /></div>
        </div>
      ))}
    </div>
  );
}

export function CommunitySearch() {
  const router = useRouter();
  const { status, user } = useAuth();
  const inst = user?.institution_id ?? null;
  const recents = useSearches();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [campusOnly, setCampusOnly] = useState(false);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => setDq(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const campus = campusOnly && !!inst;
  const searching = dq.length >= 2;
  const active = searching || cat !== null;
  const key = status === "loading" || !active ? null : `cs:${status}:${campus ? "c" : "a"}:${cat ?? ""}:${dq}`;

  const fetchPage = (page: number) => {
    const p = page > 1 ? page : undefined;
    const search = searching ? dq : undefined;
    return campus && inst
      ? homeApi.discoverAt({ institution_id: inst, category: cat, search, page: p })
      : communitiesApi.discover({ search, category: cat, page: p });
  };
  const res = useFetch(key, () => fetchPage(1), { persist: false });

  const more = extra && extra.key === key ? extra : null;
  const items = [...(res.data?.items ?? []), ...(more?.items ?? [])];
  const hasMore = more ? more.more : (res.data?.hasMore ?? false);
  const page = more?.page ?? 1;

  async function loadMore() {
    if (!key || moreBusy) return;
    setMoreBusy(true);
    try {
      const r = await fetchPage(page + 1);
      setExtra({ key, items: [...(more?.items ?? []), ...r.items], more: r.hasMore, page: page + 1 });
    } catch {
      /* the button stays; try again */
    } finally {
      setMoreBusy(false);
    }
  }

  const remember = () => {
    if (searching) addSearch(dq);
  };
  const run = (term: string) => {
    setQ(term);
    setDq(term.trim());
    addSearch(term);
  };

  let body: ReactNode;
  if (!active) {
    body = (
      <div className="pt-4">
        {recents.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center px-0.5">
              <h2 className="flex-1 text-[15px] font-extrabold tracking-tight text-fg">Recent</h2>
              <button type="button" onClick={clearSearches} className="text-secondary font-semibold text-muted">Clear all</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recents.map((r) => (
                <span key={r} className="flex items-center rounded-full bg-surface-interactive pl-3.5 text-secondary text-fg">
                  <button type="button" onClick={() => run(r)} className="max-w-[200px] truncate py-2 font-semibold">{r}</button>
                  <button type="button" aria-label={`Remove ${r}`} onClick={() => removeSearch(r)} className="grid size-9 place-items-center text-muted">
                    <Icon name="close" className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </section>
        ) : (
          <p className="px-1 text-secondary leading-[1.45] text-muted">
            {dq.length === 1 ? "Keep typing…" : "Search by community name, course code or department. Or pick a category above."}
          </p>
        )}
      </div>
    );
  } else if (res.loading && !res.data) {
    body = <RowsSkeleton />;
  } else if (res.error && !res.data) {
    body = <Empty title="Couldn't search" body={res.error}><button type="button" onClick={res.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>;
  } else if (items.length === 0) {
    body = <Empty title={searching ? `No results for "${dq}"` : "Nothing here yet"} body="Try a course code, a department or a different word." />;
  } else {
    body = (
      <div className="pt-2">
        {items.map((c) => <Row key={c.id} c={c} q={searching ? dq : ""} onOpen={remember} />)}
        {hasMore && (
          <button type="button" disabled={moreBusy} onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto mt-4 h-10")}>
            {moreBusy ? "Loading…" : "Show more"}
          </button>
        )}
      </div>
    );
  }

  return (
    <Cm>
      <header className="sticky top-0 z-30 bg-bg px-3 pb-2" style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}>
        <div className="mx-auto w-full max-w-[720px]">
          <div className="flex items-center gap-2.5 py-1">
            <button type="button" aria-label="Back" onClick={() => router.back()} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg">
              <Icon name="back" className="size-5" />
            </button>
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-3xl bg-surface-subtle pl-4 pr-1.5 focus-within:bg-surface-interactive">
              <Icon name="search" className="size-[19px] shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addSearch(q);
                    e.currentTarget.blur();
                  }
                }}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search communities, courses, departments"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-fg outline-none placeholder:text-body placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
              {q && (
                <button type="button" aria-label="Clear" onClick={() => { setQ(""); setDq(""); inputRef.current?.focus(); }} className="grid size-9 place-items-center">
                  <span className="grid size-[22px] place-items-center rounded-full bg-white/18 text-white"><Icon name="close" className="size-3.5" /></span>
                </button>
              )}
            </div>
          </div>
          <div className="no-scrollbar -mx-3 mt-2 flex gap-2 overflow-x-auto px-3">
            {inst && <Chip active={campus} onClick={() => setCampusOnly((v) => !v)}>My campus</Chip>}
            {CATEGORIES.map(([id, label]) => <Chip key={id} active={cat === id} onClick={() => setCat(cat === id ? null : id)}>{label}</Chip>)}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[720px] px-3 pb-12">{body}</div>
    </Cm>
  );
}
