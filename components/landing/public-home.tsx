/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { HomeFeed } from "@/components/home/home-feed";
import { Icon } from "@/components/ui/icon";
import { Wordmark } from "@/components/ui/wordmark";
import { openAuth } from "@/lib/auth/auth-modal";
import type { LandingCommunity, LandingTile } from "@/lib/server/landing";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-fg/40";
const CHIP = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface-interactive px-4 text-[13px] font-semibold text-fg transition-colors active:bg-surface-elevated ${FOCUS}`;

function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center justify-between px-4">
        <Link href="/" aria-label="Anaija home" className={`rounded-md ${FOCUS}`}>
          <Wordmark />
        </Link>
        <nav aria-label="Browse" className="hidden items-center gap-1 text-[14px] font-semibold text-muted md:flex">
          <Link href="/communities" className={`rounded-full px-3.5 py-2 transition-colors hover:bg-surface-interactive hover:text-fg ${FOCUS}`}>Communities</Link>
          <Link href="/watch" className={`rounded-full px-3.5 py-2 transition-colors hover:bg-surface-interactive hover:text-fg ${FOCUS}`}>Reels</Link>
        </nav>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => openAuth({ mode: "signin" })} className={`h-11 rounded-full px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-interactive ${FOCUS}`}>
            Sign in
          </button>
          <button type="button" onClick={() => openAuth({ mode: "join" })} className={`h-10 rounded-full bg-fg px-4 text-[14px] font-bold text-bg transition-transform active:scale-[0.97] ${FOCUS}`}>
            Join
          </button>
        </div>
      </div>
    </header>
  );
}

function Intro() {
  return (
    <section className="px-4 pb-4 pt-5 md:px-0 md:pt-8">
      <h1 className="text-[22px] font-bold leading-tight tracking-[-0.015em] md:text-[26px]">Welcome to Anaija</h1>
      <p className="mt-1 max-w-[44ch] text-[15px] leading-snug text-muted">
        See what&apos;s happening on campus. Find your community, your people and your next hustle.
      </p>
      <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Hustle. Flex. Earn.</p>
    </section>
  );
}

function Mark({ c, size }: { c: LandingCommunity; size: number }) {
  const box = { width: size, height: size };
  return c.avatar ? (
    <img src={c.avatar} alt="" width={size} height={size} loading="lazy" decoding="async" className="shrink-0 rounded-full bg-surface-interactive object-cover" style={box} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-surface-interactive font-bold text-fg" style={{ ...box, fontSize: size * 0.4 }}>
      {c.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ListingCard({ t, className = "" }: { t: LandingTile; className?: string }) {
  return (
    <Link href={t.href} prefetch={false} className={`block rounded-2xl ${FOCUS} ${className}`}>
      <span className="relative block aspect-square overflow-hidden rounded-2xl bg-surface-interactive" style={{ backgroundColor: t.color ?? undefined }}>
        <img src={t.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      </span>
      <span className="mt-1.5 block truncate text-[13px] font-bold">{t.price ?? "Listing"}</span>
      <span className="block truncate text-[12px] text-muted">{t.title}</span>
    </Link>
  );
}

// Mobile / tablet: a slim pathway row under the intro so the feed stays inside the first viewport.
function Explore({ communities, listings }: { communities: LandingCommunity[]; listings: LandingTile[] }) {
  const [market, setMarket] = useState(false);
  return (
    <section aria-label="Explore" className="pb-2 lg:hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 md:px-0">
        <Link href="/communities" className={CHIP}>
          <Icon name="usersGroupRounded" className="size-[18px]" /> Communities
        </Link>
        {listings.length > 0 && (
          <button type="button" aria-expanded={market} onClick={() => setMarket((m) => !m)} className={`${CHIP} ${market ? "bg-fg! text-bg!" : ""}`}>
            <Icon name="bag" className="size-[18px]" /> Marketplace
          </button>
        )}
        <Link href="/watch" className={CHIP}>
          <Icon name="clapperboard" className="size-[18px]" /> Reels
        </Link>
      </div>

      {market && listings.length > 0 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 md:px-0">
          {listings.map((t) => (
            <ListingCard key={t.id} t={t} className="w-[132px] shrink-0" />
          ))}
        </div>
      )}

      {communities.length > 0 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 md:px-0">
          {communities.map((c) => (
            <Link key={c.slug} href={`/c/${encodeURIComponent(c.slug)}`} prefetch={false} className={`flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-xl active:opacity-60 ${FOCUS}`}>
              <Mark c={c} size={56} />
              <span className="w-full truncate text-center text-[11.5px] font-medium">{c.name}</span>
            </Link>
          ))}
          <Link href="/communities" className={`flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-xl active:opacity-60 ${FOCUS}`}>
            <span className="grid size-14 place-items-center rounded-full bg-surface-interactive text-muted">
              <Icon name="search" className="size-5" />
            </span>
            <span className="text-[11.5px] font-medium text-muted">Find more</span>
          </Link>
        </div>
      )}
    </section>
  );
}

// Desktop: the same real data, always visible beside the feed.
function Aside({ communities, listings }: { communities: LandingCommunity[]; listings: LandingTile[] }) {
  if (communities.length === 0 && listings.length === 0) return null;
  return (
    <aside aria-label="Explore Anaija" className="no-scrollbar sticky top-[72px] hidden max-h-[calc(100dvh-88px)] w-[300px] shrink-0 space-y-7 overflow-y-auto py-6 lg:block">
      {communities.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-bold">Communities</h2>
            <Link href="/communities" className={`rounded text-[12px] font-semibold text-muted hover:text-fg ${FOCUS}`}>See all</Link>
          </div>
          <ul>
            {communities.map((c) => (
              <li key={c.slug}>
                <Link href={`/c/${encodeURIComponent(c.slug)}`} prefetch={false} className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-subtle ${FOCUS}`}>
                  <Mark c={c} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                    <span className="block truncate text-[12px] capitalize text-muted">
                      {[c.category, c.members > 0 ? `${compact.format(c.members)} ${c.members === 1 ? "member" : "members"}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {listings.length > 0 && (
        <section id="marketplace">
          <h2 className="mb-2 text-[13px] font-bold">Marketplace</h2>
          <div className="grid grid-cols-2 gap-3">
            {listings.slice(0, 4).map((t) => (
              <ListingCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

export function PublicHome({ communities, listings }: { communities: LandingCommunity[]; listings: LandingTile[] }) {
  return (
    <div className="pub min-h-dvh bg-bg text-fg">
      <PublicNav />
      <div className="mx-auto flex w-full max-w-[1080px] justify-center gap-10 lg:px-4">
        <main className="w-full min-w-0 max-w-[630px]">
          <Intro />
          <Explore communities={communities} listings={listings} />
          <HomeFeed variant="public" />
        </main>
        <Aside communities={communities} listings={listings} />
      </div>
    </div>
  );
}
