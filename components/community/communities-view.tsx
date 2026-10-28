"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type Community } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { CATEGORIES, Chip, Empty, categoryLabel, messageOf, useFetch } from "./kit";

function Row({ c, unread = 0 }: { c: Community; unread?: number }) {
  const meta = [categoryLabel(c.category), c.course_code, `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`].filter(Boolean).join(" · ");
  const state = c.is_member ? "Joined" : c.request_status === "pending" ? "Requested" : c.join_policy === "open" ? "Open" : c.join_policy === "request" ? "Approval" : "Invite only";
  return (
    <Link href={`/c/${c.slug}`} className="flex items-center gap-3.5 rounded-[20px] bg-surface-subtle p-3.5 transition-colors hover:bg-surface-interactive">
      <span className="relative shrink-0">
        <Avatar url={c.avatar} name={c.name} size={52} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-brand" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-fg">{c.name}</span>
        <span className="mt-0.5 block truncate text-supporting text-muted">{meta}</span>
        {c.description && <span className="mt-1 line-clamp-1 block text-secondary text-muted">{c.description}</span>}
      </span>
      <span className="shrink-0 rounded-pill bg-surface-interactive px-3 py-1.5 text-micro font-bold text-fg">{state}</span>
    </Link>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading communities" className="space-y-2.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-[20px] bg-surface-subtle p-3.5">
          <Sk className="size-[52px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Sk className="h-3.5 w-40 rounded-full" />
            <Sk className="h-3 w-56 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommunitiesView() {
  const { status } = useAuth();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [extra, setExtra] = useState<{ key: string; items: Community[]; more: boolean; page: number } | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const key = status === "loading" ? null : `disc:${status}:${dq}:${cat ?? ""}`;
  const disc = useFetch(key, () => communitiesApi.discover({ search: dq || undefined, category: cat }));
  const mine = useFetch(status === "authed" ? "mine" : null, () => communitiesApi.mine());

  const more = extra?.key === key ? extra : null;
  const items = [...(disc.data?.items ?? []), ...(more?.items ?? [])];
  const hasMore = more ? more.more : (disc.data?.hasMore ?? false);
  const page = more?.page ?? 1;

  async function loadMore() {
    if (!key || moreBusy) return;
    setMoreBusy(true);
    try {
      const r = await communitiesApi.discover({ search: dq || undefined, category: cat, page: page + 1 });
      setExtra({ key, items: [...(more?.items ?? []), ...r.items], more: r.hasMore, page: page + 1 });
    } catch {
      /* the button stays; try again */
    } finally {
      setMoreBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-12 pt-3 md:pt-8">
      <header className="mb-4 flex items-center gap-3 py-2">
        <h1 className="flex-1 text-[28px] font-extrabold tracking-tight text-fg">Communities</h1>
      </header>

      {status === "authed" && mine.data && mine.data.length > 0 && (
        <section className="mb-6">
          <p className="px-1 pb-2 text-micro font-semibold uppercase tracking-[0.08em] text-muted">Your communities</p>
          <div className="space-y-2.5">
            {mine.data.map((c) => (
              <Row key={c.id} c={c} unread={c.chat_unread} />
            ))}
          </div>
        </section>
      )}

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className={`${inputClass} pl-11`} placeholder="Search classes, departments, interests" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        <Chip active={cat === null} onClick={() => setCat(null)}>All</Chip>
        {CATEGORIES.map(([id, label]) => (
          <Chip key={id} active={cat === id} onClick={() => setCat(cat === id ? null : id)}>{label}</Chip>
        ))}
      </div>

      <div className="mt-4">
        {disc.loading ? (
          <Skeleton />
        ) : disc.error ? (
          <Empty title="Couldn't load communities" body={disc.error}>
            <button type="button" onClick={disc.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
          </Empty>
        ) : items.length === 0 ? (
          <Empty title={dq || cat ? "No matches" : "No communities yet"} body={dq || cat ? "Try a different search." : "Be the first to start one for your class, department or interest."}>
            <Link href="/communities/new" className={buttonClass("primary", "h-10 px-5")}>Create a community</Link>
          </Empty>
        ) : (
          <div className="space-y-2.5">
            {items.map((c) => (
              <Row key={c.id} c={c} />
            ))}
            {hasMore && (
              <button type="button" disabled={moreBusy} onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto h-10")}>
                {moreBusy ? "Loading…" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
      {mine.error && <p className="mt-4 text-center text-secondary text-muted">{messageOf(mine.error)}</p>}
    </div>
  );
}
