/* eslint-disable @next/next/no-img-element */
"use client";

import type { DiscoverItem } from "@/lib/api/discover";
import { coverOf, imageCount, tileAspect } from "@/lib/discover/tile";
import { BagGlyph, ClapperboardGlyph, LayersGlyph, PlayGlyph } from "./glyphs";

const RADIUS = "rounded-[3px]";

export type VideoBadge = "play" | "clapper";

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`absolute grid size-5 place-items-center rounded-full text-white ${className}`}>{children}</span>
  );
}

// Port of DiscoverPostCard / DiscoverListingCard: media at its own aspect, nothing underneath.
// videoBadge: Discover keeps the play glyph; the profile grid uses the clapperboard.
export function DiscoverCard({
  item,
  onOpen,
  videoBadge = "play",
}: {
  item: DiscoverItem;
  onOpen: () => void;
  videoBadge?: VideoBadge;
}) {
  const post = item.post;
  const cover = coverOf(post);
  const isListing = item.kind === "listing";
  const hasImage = !!cover.url;
  const aspect = tileAspect(cover.aspect, isListing ? true : hasImage);
  const multi = imageCount(post) > 1;
  const caption = (post.caption ?? "").trim();
  const price = post.listing?.formatted_price;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative block w-full overflow-hidden bg-card text-left ${RADIUS}`}
      style={{ aspectRatio: String(aspect), backgroundColor: cover.color ?? undefined }}
    >
      {hasImage ? (
        <img
          src={cover.url!}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--color-card-alt),var(--color-card))] p-2.5 text-center">
          <span className="line-clamp-7 text-[11.5px] font-medium leading-[1.35] text-fg">{caption}</span>
        </span>
      )}

      {isListing && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-black/55" />}

      {isListing && (
        <Badge className="left-1.5 top-1.5 size-[22px] bg-white text-black shadow-[0_0_6px_rgba(0,0,0,0.3)]">
          <BagGlyph className="size-[13px]" />
        </Badge>
      )}
      {cover.isVideo ? (
        <Badge className="right-1.5 top-1.5 bg-black/55">
          {videoBadge === "clapper" ? <ClapperboardGlyph className="size-[13px]" /> : <PlayGlyph className="size-[13px]" />}
        </Badge>
      ) : (
        multi && (
          <Badge className="right-1.5 top-1.5 bg-black/55">
            <LayersGlyph className="size-[13px]" />
          </Badge>
        )
      )}

      {isListing && price && (
        <span className="absolute bottom-1.5 right-1.5 max-w-[calc(100%-12px)] truncate rounded-full border border-white/16 bg-black/65 px-2 py-[3px] text-[11px] font-bold text-white">
          ₦{price}
        </span>
      )}
      {isListing && <span className={`pointer-events-none absolute inset-0 border border-white/16 ${RADIUS}`} />}
    </button>
  );
}
