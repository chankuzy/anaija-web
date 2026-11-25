"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OfficialMark } from "@/components/community/kit";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api/client";
import type { DiscoveredCommunity, DiscoveredPerson } from "@/lib/api/discoveries";
import type { MatchReason, Opportunity } from "@/lib/api/opportunities";
import { useAuth } from "@/lib/auth/auth-context";
import { openAuth } from "@/lib/auth/auth-modal";
import { useDiscoveries } from "@/lib/discoveries/use-discoveries";

const act = (id: number, action: string) => api.post<{ ok: boolean }>(`users/opportunity-action/${id}`, { action });

// Only http(s) links are ever rendered as links: provenance data is not trusted to be a safe URL.
function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? p.toString() : null;
  } catch {
    return null;
  }
}

const kindLabel = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function closes(o: Opportunity): string | null {
  if (o.is_rolling) return "Rolling applications";
  if (!o.expires_at) return "No deadline listed";
  const d = new Date(o.expires_at);
  if (Number.isNaN(d.getTime())) return null;
  return `Closes ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

function Reasons({ reasons }: { reasons: MatchReason[] }) {
  if (!reasons.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {reasons.map((r) => (
        <li key={r.code} className="rounded-full bg-surface-interactive px-2.5 py-1 text-supporting font-semibold text-fg">
          {r.label}
        </li>
      ))}
    </ul>
  );
}

function OpportunityCard({
  o, onSave, onDismiss,
}: { o: Opportunity; onSave: (o: Opportunity) => void; onDismiss: (o: Opportunity) => void }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState(false);
  const verified = o.verification === "verified";
  const apply = safeUrl(o.apply_url);
  const source = safeUrl(o.source_url);
  const deadline = closes(o);
  const where = [o.location_mode ? kindLabel(o.location_mode) : null, o.location_text].filter(Boolean).join(" · ");

  return (
    <article className="rounded-2xl bg-surface-subtle p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-micro font-bold uppercase tracking-[0.12em] text-muted">{kindLabel(o.kind)}</p>
          <h3 className="mt-1 text-[16px] font-extrabold leading-snug tracking-tight text-fg">{o.title}</h3>
          {o.provider_name && <p className="mt-0.5 text-secondary text-muted">{o.provider_name}</p>}
        </div>
        <button
          type="button"
          aria-label="Not interested"
          onClick={() => onDismiss(o)}
          className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-interactive hover:text-fg"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>

      <p className={`mt-2 text-body leading-[1.45] text-fg ${open ? "" : "line-clamp-3"}`}>{o.summary}</p>
      {open && o.requirements && (
        <div className="mt-3">
          <p className="text-micro font-bold uppercase tracking-[0.12em] text-muted">Requirements</p>
          <p className="mt-1 whitespace-pre-line text-body leading-[1.45] text-fg">{o.requirements}</p>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-secondary font-semibold text-muted hover:text-fg">
        {open ? "Show less" : "Show more"}
      </button>

      <Reasons reasons={o.reasons} />

      <div className="mt-3 space-y-1 text-supporting text-muted">
        <p className="flex items-center gap-1.5">
          {verified && <Icon name="verifiedCheck" filled className="size-4 text-brand-ink" />}
          <span className={verified ? "font-bold text-fg" : ""}>{o.verification_label}</span>
        </p>
        <p>
          Source: {o.provenance}
          {source && (
            <>
              {" · "}
              <a href={source} target="_blank" rel="noopener noreferrer" className="font-semibold text-fg underline-offset-2 hover:underline">
                View source
              </a>
            </>
          )}
        </p>
        {(deadline || where) && <p>{[deadline, where].filter(Boolean).join(" · ")}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {o.apply_method === "external_link" && apply && (
          <a
            href={apply}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void act(o.id, "apply_click").catch(() => {})}
            className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg transition-transform active:scale-[0.97]"
          >
            Apply
          </a>
        )}
        {o.apply_method === "contact" && o.apply_url && (
          <button
            type="button"
            onClick={() => {
              setContact(true);
              void act(o.id, "apply_click").catch(() => {});
            }}
            className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg transition-transform active:scale-[0.97]"
          >
            How to apply
          </button>
        )}
        <button
          type="button"
          onClick={() => onSave(o)}
          aria-pressed={o.saved}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated"
        >
          <Icon name="bookmark" filled={o.saved} className="size-4" />
          {o.saved ? "Saved" : "Save"}
        </button>
      </div>
      {contact && o.apply_url && <p className="selectable mt-3 break-words text-body font-semibold text-fg">{o.apply_url}</p>}
    </article>
  );
}

function PersonCard({ p, onDismiss }: { p: DiscoveredPerson; onDismiss: () => void }) {
  const inner = (
    <>
      <Avatar url={p.avatar} name={p.name ?? p.username ?? undefined} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-fg">{p.name ?? p.username ?? "Anaija member"}</span>
        {p.username && <span className="block truncate text-secondary text-muted">@{p.username}</span>}
      </span>
    </>
  );
  return (
    <article className="rounded-2xl bg-surface-subtle p-4">
      <p className="text-micro font-bold uppercase tracking-[0.12em] text-muted">Person</p>
      <div className="mt-2 flex items-center gap-3">
        {p.username ? (
          <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            {inner}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
        )}
        <button
          type="button"
          aria-label="Not interested"
          onClick={onDismiss}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-interactive hover:text-fg"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <Reasons reasons={p.reasons} />
      <p className="mt-2 text-supporting text-muted">Based on what you both said on your profiles.</p>
    </article>
  );
}

function CommunityCard({ c }: { c: DiscoveredCommunity }) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[15px] font-bold text-fg">{c.name}</span>
        {c.academic_origin && <OfficialMark />}
      </span>
      {typeof c.members_count === "number" && <span className="mt-0.5 block text-secondary text-muted">{c.members_count} members</span>}
    </>
  );
  return (
    <article className="rounded-2xl bg-surface-subtle p-4">
      <p className="text-micro font-bold uppercase tracking-[0.12em] text-muted">Community</p>
      <div className="mt-2">
        {c.slug ? (
          <Link href={`/c/${c.slug}`} className="block">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
      <Reasons reasons={c.reasons} />
    </article>
  );
}

function Empty({ title, body, cta }: { title: string; body: string; cta?: { label: string; href?: string; onClick?: () => void } }) {
  const cls = "mt-5 inline-flex h-10 items-center rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg";
  return (
    <div className="grid place-items-center px-6 py-20 text-center">
      <div className="max-w-[360px]">
        <p className="text-[15px] font-bold text-fg">{title}</p>
        <p className="mt-1 text-secondary leading-[1.45] text-muted">{body}</p>
        {cta?.href && (
          <Link href={cta.href} className={cls}>
            {cta.label}
          </Link>
        )}
        {cta?.onClick && (
          <button type="button" onClick={cta.onClick} className={cls}>
            {cta.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function DiscoveriesView() {
  const { status: auth } = useAuth();
  const authed = auth === "authed";
  const d = useDiscoveries(authed);
  const [hiddenPeople, setHiddenPeople] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (auth === "guest") openAuth();
  }, [auth]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !d.hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && d.loadMore(), { rootMargin: "700px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [d.items.length, d.hasMore, d.loadMore]);

  const items = d.items.filter((i) => !hiddenPeople.has(i.id));

  function save(o: Opportunity) {
    const next = !o.saved;
    d.patchOpportunity(o.id, { saved: next });
    act(o.id, next ? "save" : "unsave").catch(() => d.patchOpportunity(o.id, { saved: o.saved }));
  }
  function dismiss(itemId: string, o: Opportunity) {
    d.remove(itemId);
    act(o.id, "dismiss").catch(() => d.reload());
  }

  let body: React.ReactNode;
  if (!authed || (d.loading && items.length === 0)) {
    body = (
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk-block h-44 rounded-2xl" />
        ))}
      </div>
    );
  } else if (d.error && items.length === 0) {
    body = <Empty title="Couldn't load Discoveries" body={d.error} cta={{ label: "Try again", onClick: d.reload }} />;
  } else if (items.length === 0) {
    if (d.status === "personalization_off") {
      body = <Empty title="Personalization is off" body="Discoveries are matched from what you declare on your profile. Turn personalization on to see them." cta={{ label: "Open setup", href: "/setup?personalize=1" }} />;
    } else if (d.status === "no_declared_data") {
      body = <Empty title="Tell us what you're into" body="Add your interests, skills and goals and we'll match opportunities, people and communities to them. Nothing is guessed from what you watch." cta={{ label: "Personalize", href: "/setup?personalize=1" }} />;
    } else {
      body = <Empty title="Nothing matches yet" body="New opportunities appear here as they're published and verified. We don't fill the gap with anything that isn't real." cta={{ label: "Refresh", onClick: d.reload }} />;
    }
  } else {
    body = (
      <>
        <div className="space-y-3">
          {items.map((i) =>
            i.type === "opportunity" ? (
              <OpportunityCard key={i.id} o={i.data} onSave={save} onDismiss={(o) => dismiss(i.id, o)} />
            ) : i.type === "person" ? (
              <PersonCard key={i.id} p={i.data} onDismiss={() => setHiddenPeople((s) => new Set(s).add(i.id))} />
            ) : (
              <CommunityCard key={i.id} c={i.data} />
            ),
          )}
        </div>
        <div ref={sentinel} className="h-px" />
        {d.loadingMore && <div className="sk-block mt-3 h-24 rounded-2xl" aria-hidden="true" />}
        {!d.hasMore && !d.loading && <p className="px-6 pb-4 pt-7 text-center text-secondary text-muted">That&apos;s everything that matches right now.</p>}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-8 pt-4 md:pt-8">
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-extrabold tracking-tight text-fg">Discoveries</h1>
          <p className="mt-1 text-secondary leading-[1.4] text-muted">Matched only from what you&apos;ve declared. Nothing is inferred from your activity.</p>
        </div>
        <button
          type="button"
          onClick={d.reload}
          aria-label="Refresh"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg transition-colors hover:bg-surface-interactive active:scale-95"
        >
          <Icon name="refresh" className={`size-[18px] ${d.loading && items.length > 0 ? "animate-spin" : ""}`} />
        </button>
      </header>
      {body}
    </div>
  );
}
