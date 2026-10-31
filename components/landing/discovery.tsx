/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { LandingCommunity, LandingTile } from "@/lib/server/landing";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const RING = "outline-none focus-visible:ring-2 focus-visible:ring-brand/80";

/** A real public post, reel or listing. Fixed 4:5 box, so images arriving late never shift the page. */
export function Tile({ t }: { t: LandingTile }) {
  return (
    <Link
      href={t.href}
      prefetch={false}
      aria-label={t.title}
      className={`group relative block aspect-[4/5] w-[56vw] max-w-[240px] overflow-hidden rounded-[22px] bg-[#19191d] transition-transform duration-150 active:scale-[0.98] md:w-auto md:max-w-none ${RING}`}
      style={{ backgroundColor: t.color ?? undefined }}
    >
      <img
        src={t.image}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      {t.kind !== "post" && (
        <span className="icon-shadow absolute left-3 top-3 text-white">
          <Icon name={t.kind === "reel" ? "play" : "bag"} filled className="size-[22px]" />
        </span>
      )}
      <span className="absolute inset-x-3 bottom-3">
        {t.price && <span className="mb-1.5 inline-block rounded-full bg-brand px-2.5 py-0.5 text-[12px] font-extrabold text-brand-fg">{t.price}</span>}
        <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-white text-shadow">{t.title}</span>
        {t.byline && <span className="mt-0.5 block truncate text-[11px] text-white/65">{t.byline}</span>}
      </span>
    </Link>
  );
}

/** A discoverable community. Links to its normal public page (which enforces its own read policy). */
export function CommunityCard({ c }: { c: LandingCommunity }) {
  return (
    <Link
      href={`/c/${encodeURIComponent(c.slug)}`}
      prefetch={false}
      className={`block w-[72vw] max-w-[290px] overflow-hidden rounded-[22px] bg-[#111114] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-transform duration-150 active:scale-[0.98] md:w-auto md:max-w-none ${RING}`}
    >
      <div className="relative h-20 bg-[linear-gradient(135deg,#2a2412,#141416)]">
        {c.cover && <img src={c.cover} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="px-4 pb-4">
        <span className="-mt-7 grid size-14 place-items-center overflow-hidden rounded-full bg-[#26262b] ring-4 ring-[#111114]">
          {c.avatar ? (
            <img src={c.avatar} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
          ) : (
            <span className="text-[20px] font-extrabold text-brand">{c.name.slice(0, 1).toUpperCase()}</span>
          )}
        </span>
        <p className="mt-2.5 truncate text-[15px] font-bold">{c.name}</p>
        <p className="mt-0.5 truncate text-[12px] capitalize text-white/50">
          {[c.category, c.members > 0 ? `${compact.format(c.members)} ${c.members === 1 ? "member" : "members"}` : null].filter(Boolean).join(" · ")}
        </p>
        {c.description && <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-white/60">{c.description}</p>}
      </div>
    </Link>
  );
}
