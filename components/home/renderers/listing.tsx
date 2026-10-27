"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { frameAspect } from "@/lib/feed/content";
import { formatCompactLocation } from "@/lib/location/types";
import { ImageCarousel, slidesOf } from "./image-carousel";
import type { BodyProps } from "./types";

const COND: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };
const TYPE_LABEL: Record<string, string> = { service: "Service", business: "Business", rental: "Rental", wanted: "Wanted" };
const PRICE_PREFIX: Record<string, string> = { service: "From", business: "From", wanted: "Budget" };
const CTA: Record<string, string> = { service: "View service", business: "View business", wanted: "See request", rental: "View rental" };

// Marketplace: the product leads. Images slide on their own, then price, title and where, then one clear action.
export function ListingBody({ post, index, active, paused, onOpen, onLike }: BodyProps) {
  const d = post.listing;
  const type = post.listing_type ?? "product";
  const slides = slidesOf(post);
  const title = ((type === "business" ? d?.business_name : null) || post.caption || "").trim();
  const where = d?.location_info ? formatCompactLocation(d.location_info) : (d?.pickup_info || post.location || "");
  const cond = d?.condition ? COND[d.condition] : null;
  const prefix = PRICE_PREFIX[type];
  const closed = d?.status === "sold" || d?.status === "reserved";

  return (
    <div>
      <ImageCarousel
        slides={slides}
        aspect={Math.min(frameAspect("gallery", post), 1.25)}
        index={index}
        active={active}
        paused={paused}
        intervalMs={4200}
        onOpen={onOpen}
        onLike={onLike}
        label="Open listing"
      >
        {slides.length === 0 && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-white/35">
            <Icon name="bag" filled className="size-10" />
          </span>
        )}
        {closed && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-pill bg-black/70 px-3 py-1 text-micro font-bold uppercase tracking-wide text-white">
            {d?.status === "sold" ? "Sold" : "Reserved"}
          </span>
        )}
      </ImageCarousel>

      <div className="mt-3.5">
        {TYPE_LABEL[type] && <p className="mb-1 text-micro font-bold uppercase tracking-wider text-muted">{TYPE_LABEL[type]}</p>}
        {d && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {prefix && <span className="text-secondary text-muted">{prefix}</span>}
            <span className="text-[22px] font-extrabold tracking-tight text-fg">
              <span className="mr-0.5 text-brand">₦</span>
              {d.formatted_price}
            </span>
            {d.price_type === "negotiable" && d.status !== "sold" && (
              <span className="rounded-pill bg-brand/15 px-2 py-0.5 text-micro font-bold text-brand">Nego</span>
            )}
          </div>
        )}
        {title && <p className="mt-1 line-clamp-2 text-label font-medium leading-snug text-fg">{title}</p>}
        {(cond || where) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-secondary text-muted">
            {cond && <span>{cond}</span>}
            {cond && where && <span aria-hidden>·</span>}
            {where && (
              <span className="flex min-w-0 items-center gap-1">
                <Icon name={d?.location_info?.campus ? "mapPointSchool" : "pointOnMap"} className="size-3.5 shrink-0" />
                <span className="truncate">{where}</span>
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function ListingCta({ post }: { post: Post }) {
  const closed = post.listing?.status === "sold";
  const label = CTA[post.listing_type ?? "product"] ?? "View listing";
  return (
    <Link
      href={`/l/${post.id}`}
      className={`inline-flex h-11 w-full items-center justify-center rounded-pill text-secondary font-extrabold transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ${
        closed ? "bg-surface-interactive text-fg hover:bg-surface-elevated" : "bg-brand text-brand-fg hover:bg-brand-hover"
      }`}
    >
      {label}
    </Link>
  );
}
