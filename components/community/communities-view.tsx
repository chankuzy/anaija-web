"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Sk } from "@/components/ui/skeleton";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useActivity } from "@/lib/activity/activity-context";
import { communitiesApi, type Community, type MineRow } from "@/lib/api/communities";
import { homeApi, type Pulse } from "@/lib/api/community-home";
import { mediaUrl } from "@/lib/api/feed";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { useRecent } from "@/lib/community/recent";
import { timeAgo } from "@/lib/format";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { usePullRefresh } from "@/lib/ui/use-pull-refresh";
import { CATEGORIES, Chip, Cm, Empty, SectionHead, Sheet, StatusChip, categoryLabel, useFetch } from "./kit";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const metaOf = (c: Community) => [categoryLabel(c.category), c.course_code, plural(c.members_count, "member", "members")].filter(Boolean).join(" · ");

function CommunityRow({ c, reason }: { c: Community; reason?: string | null }) {
  const state = c.is_member ? "Joined" : c.request_status === "pending" ? "Requested" : c.join_policy === "open" ? "Open" : c.join_policy === "request" ? "Approval" : "Invite only";
  return (
    <Link href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-2xl px-1 py-2.5 transition-colors active:bg-surface-interactive">
      <Avatar url={c.avatar} name={c.name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-fg">{c.name}</span>
        <span className="mt-0.5 block truncate text-supporting text-muted">{metaOf(c)}</span>
        {reason && <span className="mt-0.5 block truncate text-supporting font-semibold text-brand-ink">{reason}</span>}
      </span>
      <span className="shrink-0 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{state}</span>
    </Link>
  );
}

function RowsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-1.5">
          <Sk className="size-12 rounded-full" />
          <div className="flex-1 space-y-2"><Sk className="h-3.5 w-40 rounded-full" /><Sk className="h-3 w-56 rounded-full" /></div>
        </div>
      ))}
    </div>
  );
}

// ── My communities ────────────────────────────────────────────────────────────────────────
function MineTile({ c }: { c: MineRow }) {
  return (
    <Link href={`/c/${c.slug}`} className="relative flex w-[136px] shrink-0 flex-col rounded-2xl border border-line bg-surface-subtle p-3 transition-colors active:bg-surface-interactive">
      <span className="relative w-fit">
        <Avatar url={c.avatar} name={c.name} size={44} />
        {c.chat_unread > 0 && (
          <span aria-label={`${c.chat_unread} unread chat messages`} className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-brand-fg ring-2 ring-surface">
            {c.chat_unread > 99 ? "99+" : c.chat_unread}
          </span>
        )}
      </span>
      <span className="mt-2.5 line-clamp-2 block min-h-[32px] text-[13.5px] font-bold leading-[1.2] text-fg">{c.name}</span>
      <span className="mt-1 block truncate text-micro text-muted">{c.course_code ?? categoryLabel(c.category)} · {c.members_count}</span>
    </Link>
  );
}

// ── Pulse: only what the backend returned, grouped, never padded ────────────────────────────────
function PulseRow({ href, icon, title, sub, tail }: { href: string; icon: IconName; title: string; sub: string; tail?: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-3 transition-colors active:bg-surface-interactive">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-interactive text-fg"><Icon name={icon} className="size-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-[14px] font-semibold text-fg">{title}</span>
        <span className="mt-0.5 line-clamp-1 block text-supporting text-muted">{sub}</span>
      </span>
      {tail}
    </Link>
  );
}

function PulseCard({ p, loading }: { p: Pulse | undefined; loading: boolean }) {
  const rows: ReactNode[] = [];
  for (const s of (p?.sessions ?? []).slice(0, 3)) {
    rows.push(
      <PulseRow key={`s${s.id}`} href={`/s/${s.code}`} icon="eyeClosed" title={s.title}
        sub={`${s.community.name} · ${plural(s.posts_count, "post", "posts")} · ${plural(s.participants_count, "participant", "participants")}`}
        tail={<StatusChip status={s.status} />} />,
    );
  }
  for (const d of (p?.discussions ?? []).slice(0, 3)) {
    rows.push(<PulseRow key={`d${d.id}`} href={`/p/${d.id}`} icon="message" title={d.title} sub={`${d.community.name} · ${plural(d.comments ?? 0, "comment", "comments")}`} />);
  }
  for (const e of (p?.events ?? []).slice(0, 3)) {
    const when = new Date(e.event_at).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
    rows.push(<PulseRow key={`e${e.id}`} href={`/p/${e.id}`} icon="star" title={e.title} sub={`${e.community.name} · ${when}`} />);
  }
  return (
    <section>
      <SectionHead title="What's happening" />
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-subtle">
        {loading && !p ? (
          <div className="space-y-3 p-3"><Sk className="h-9 w-full rounded-xl" /><Sk className="h-9 w-full rounded-xl" /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-5 text-secondary leading-[1.4] text-muted">Quiet right now. Live sessions, active discussions and upcoming events from your communities show up here.</p>
        ) : rows}
      </div>
    </section>
  );
}

// ── Highlights: pinned and recent announcements, newly shared resources ───────────────────────────
function Highlights({ p }: { p: Pulse | undefined }) {
  const ann = [...(p?.announcements ?? [])].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).slice(0, 4);
  const res = (p?.resources ?? []).slice(0, 3);
  if (!ann.length && !res.length) return null;
  const card = "flex w-[232px] shrink-0 flex-col rounded-2xl border border-line bg-surface-subtle p-3.5 transition-colors active:bg-surface-interactive";
  return (
    <section>
      <SectionHead title="Highlights" />
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {ann.map((a) => (
          <Link key={`a${a.id}`} href={`/p/${a.id}`} className={card}>
            <span className="flex items-center gap-2">
              <Avatar url={a.community.avatar} name={a.community.name} size={20} />
              <span className="min-w-0 flex-1 truncate text-supporting font-semibold text-muted">{a.community.name}</span>
              {a.pinned && <span className="text-micro font-extrabold uppercase tracking-[0.08em] text-brand-ink">Pinned</span>}
            </span>
            <span className="mt-2.5 line-clamp-3 block text-[14px] font-bold leading-[1.3] text-fg">{a.title}</span>
            <span className="mt-2 block text-supporting text-muted">Announcement · {timeAgo(a.created_at)}</span>
          </Link>
        ))}
        {res.map((r) => (
          <Link key={`r${r.id}`} href={`/c/${r.community.slug}?tab=library`} className={card}>
            <span className="flex items-center gap-2">
              <Avatar url={r.community.avatar} name={r.community.name} size={20} />
              <span className="min-w-0 flex-1 truncate text-supporting font-semibold text-muted">{r.community.name}</span>
            </span>
            <span className="mt-2.5 line-clamp-3 block text-[14px] font-bold leading-[1.3] text-fg">{r.title}</span>
            <span className="mt-2 block text-supporting text-muted">{[r.course_code, "Resource"].filter(Boolean).join(" · ")} · {timeAgo(r.created_at)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CommunitiesView() {
  const { status, user } = useAuth();
  const authed = status === "authed";
  const { unseen } = useActivity();
  const panel = useNotificationsPanel();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [scope, setScope] = useState<"campus" | "all" | null>(null);
  const [all, setAll] = useState(false);
  const [extra, setExtra] = useState<{ key: string; items: Community[]; more: boolean; page: number } | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const inst = user?.institution_id ?? null;
  const sc = scope ?? (inst ? "campus" : "all");
  const campus = sc === "campus" && !!inst;

  const mine = useFetch(authed ? "mine" : null, () => communitiesApi.mine());
  const mineList = [...(mine.data ?? [])].sort((a, b) => Number(b.chat_unread > 0) - Number(a.chat_unread > 0));
  const hasMine = mineList.length > 0;
  const pulse = useFetch(authed && hasMine ? "pulse" : null, () => homeApi.pulse());
  const recent = useRecent();
  const mineSlugs = new Set(mineList.map((c) => c.slug));
  const viewed = recent.filter((r) => !mineSlugs.has(r.slug)).slice(0, 6);

  const dkey = status === "loading" ? null : `disc2:${status}:${campus ? "campus" : "all"}:${cat ?? ""}`;
  const disc = useFetch(dkey, () => (campus && inst ? homeApi.discoverAt({ institution_id: inst, category: cat }) : communitiesApi.discover({ category: cat })));
  const found = useFetch(dq ? `find:${status}:${dq}` : null, () => communitiesApi.discover({ search: dq }), { persist: false });

  const more = extra?.key === dkey ? extra : null;
  const items = [...(disc.data?.items ?? []), ...(more?.items ?? [])].filter((c) => !c.is_member);
  const hasMore = more ? more.more : (disc.data?.hasMore ?? false);
  const page = more?.page ?? 1;

  async function loadMore() {
    if (!dkey || moreBusy) return;
    setMoreBusy(true);
    try {
      const r = campus && inst
        ? await homeApi.discoverAt({ institution_id: inst, category: cat, page: page + 1 })
        : await communitiesApi.discover({ category: cat, page: page + 1 });
      setExtra({ key: dkey, items: [...(more?.items ?? []), ...r.items], more: r.hasMore, page: page + 1 });
    } catch {
      /* the button stays; try again */
    } finally {
      setMoreBusy(false);
    }
  }

  const { reload: reloadMine } = mine;
  const { reload: reloadPulse } = pulse;
  const { reload: reloadDisc } = disc;
  const { pull, refreshing } = usePullRefresh({
    enabled: !dq,
    onRefresh: () => {
      reloadMine();
      reloadPulse();
      reloadDisc();
    },
  });
  const avatar = user ? mediaUrl(user.avatar) : null;

  return (
    <Cm>
      <div className="mx-auto w-full max-w-[1040px] px-4 pb-12 pt-3 md:pt-8">
        <div aria-hidden style={{ height: pull }} className="flex items-end justify-center overflow-hidden">
          {pull > 8 && (
            <span
              className={`mb-2 size-5 rounded-full border-2 border-muted/40 border-t-fg ${refreshing ? "animate-spin" : ""}`}
              style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
            />
          )}
        </div>

        <header className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-fg">Communities</h1>
            <p className="mt-1.5 truncate text-secondary text-muted">Your campus. Your people. Your conversations.</p>
          </div>
          {authed ? (
            <>
              <button type="button" aria-label="Notifications" onClick={panel.toggle} className="relative grid size-10 place-items-center rounded-full bg-surface-subtle ring-1 ring-line md:hidden">
                <Icon name="bell" className="size-5" />
                {unseen > 0 && <span className="absolute -right-1 -top-1"><UnreadBadge count={unseen} label="new notifications" /></span>}
              </button>
              <Link href="/me" aria-label="Your profile" className="rounded-full ring-1 ring-line md:hidden"><Avatar url={avatar} name={user?.name ?? user?.username} size={40} /></Link>
              <Link href="/communities/new" className={buttonClass("outline", "hidden h-10 px-4 md:inline-flex")}>
                <Icon name="plus" className="size-4" />New community
              </Link>
            </>
          ) : status === "guest" ? (
            <Link href={loginHref()} className={buttonClass("primary", "h-10 px-5")}>Sign in</Link>
          ) : null}
        </header>

        <div className="relative mt-4">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input className={`${inputClass} pl-11 pr-11`} placeholder="Search communities, courses, departments" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-interactive">
              <Icon name="close" className="size-4" />
            </button>
          )}
        </div>

        {dq ? (
          <div className="mt-5">
            {found.loading ? <RowsSkeleton /> : found.error ? (
              <Empty title="Couldn't search" body={found.error}><button type="button" onClick={found.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
            ) : !found.data?.items.length ? (
              <Empty title="No matches" body="Try a course code, a department or a different word." />
            ) : (
              <div className="grid gap-x-8 md:grid-cols-2">{found.data.items.map((c) => <CommunityRow key={c.id} c={c} />)}</div>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-10 lg:gap-y-8">
            <section className="min-w-0 lg:col-start-1 lg:row-start-1">
              <SectionHead title="My communities">
                {hasMine && <button type="button" onClick={() => setAll(true)} className="text-secondary font-bold text-muted hover:text-fg">See all</button>}
              </SectionHead>
              {!authed && status !== "loading" ? (
                <div className="rounded-2xl border border-line bg-surface-subtle p-4">
                  <p className="text-[15px] font-bold text-fg">Find where you belong</p>
                  <p className="mt-1 text-secondary leading-[1.4] text-muted">Sign in to join classes, departments and interests, and keep them one tap away.</p>
                  <Link href={loginHref()} className={buttonClass("primary", "mt-3 h-10 px-5")}>Sign in</Link>
                </div>
              ) : mine.loading ? (
                <div role="status" aria-busy="true" aria-label="Loading your communities" className="no-scrollbar -mx-4 flex gap-2.5 overflow-hidden px-4 lg:mx-0 lg:px-0">
                  {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-[118px] w-[136px] shrink-0 rounded-2xl" />)}
                </div>
              ) : !hasMine ? (
                <p className="rounded-2xl border border-line bg-surface-subtle px-4 py-5 text-secondary leading-[1.4] text-muted">You haven&apos;t joined any community yet. Start with the ones below.</p>
              ) : (
                <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                  {mineList.map((c) => <MineTile key={c.id} c={c} />)}
                </div>
              )}
              {authed && viewed.length > 0 && (
                <div className="no-scrollbar -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                  <span className="shrink-0 text-micro font-semibold uppercase tracking-[0.08em] text-muted">Recently viewed</span>
                  {viewed.map((r) => (
                    <Link key={r.slug} href={`/c/${r.slug}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-surface-interactive pl-1.5 pr-3.5 text-secondary font-bold text-fg">
                      <Avatar url={r.avatar} name={r.name} size={24} />
                      <span className="max-w-[140px] truncate">{r.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {authed && (mine.loading || hasMine) && (
              <div className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                <PulseCard p={pulse.data} loading={mine.loading || pulse.loading} />
                <Highlights p={pulse.data} />
              </div>
            )}

            <section className="min-w-0 lg:col-start-1 lg:row-start-2">
              <SectionHead title="Discover" />
              {inst && (
                <div className="mb-2 flex gap-2">
                  <Chip active={campus} onClick={() => { setScope("campus"); setExtra(null); }}>My campus</Chip>
                  <Chip active={!campus} onClick={() => { setScope("all"); setExtra(null); }}>Everywhere</Chip>
                </div>
              )}
              <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                <Chip active={cat === null} onClick={() => setCat(null)}>All</Chip>
                {CATEGORIES.map(([id, label]) => <Chip key={id} active={cat === id} onClick={() => setCat(cat === id ? null : id)}>{label}</Chip>)}
              </div>
              {disc.loading ? <RowsSkeleton n={5} /> : disc.error && !disc.data ? (
                <Empty title="Couldn't load communities" body={disc.error}><button type="button" onClick={disc.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
              ) : items.length === 0 ? (
                <Empty
                  title={cat ? "No matches" : campus ? "Nothing new at your campus" : "Nothing new to discover"}
                  body={campus ? "You've joined everything listed here. Look beyond your campus or start one." : "Be the first to start one for your class, department or interest."}
                >
                  {campus && <button type="button" onClick={() => setScope("all")} className={buttonClass("outline", "h-10 px-5")}>Everywhere</button>}
                  <Link href="/communities/new" className={buttonClass("primary", "h-10 px-5")}>Create a community</Link>
                </Empty>
              ) : (
                <>
                  <div className="grid gap-x-8 md:grid-cols-2">
                    {items.map((c) => <CommunityRow key={c.id} c={c} reason={!campus && inst && c.institution_id === inst ? "At your campus" : null} />)}
                  </div>
                  {hasMore && (
                    <button type="button" disabled={moreBusy} onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto mt-4 h-10")}>
                      {moreBusy ? "Loading…" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {all && (
        <Sheet title="Your communities" onClose={() => setAll(false)} wide>
          <div>{mineList.map((c) => <CommunityRow key={c.id} c={c} />)}</div>
        </Sheet>
      )}
    </Cm>
  );
}
