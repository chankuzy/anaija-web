"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { frameAspect } from "@/lib/feed/content";
import { formatCompactLocation } from "@/lib/location/types";
import { ImageCarousel, slidesOf } from "./image-carousel";
import type { BodyProps } from "./types";

const COND: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };
const TYPE_LABEL: Record<string, string> = { service: "Service", business: "Business", rental: "Rental", wanted: "Wanted" };
const PRICE_PREFIX: Record<string, string> = { service: "From", business: "From", wanted: "Budget" };
const CTA: Record<string, string> = { service: "View service", business: "View business", wanted: "See request", rental: "View rental" };

// Marketplace: the product leads. Images slide on their own, and the price sits on the image as one frosted button
// (price, Nego, arrow) that takes you straight to the listing. Title and where sit underneath.
// Colour: white and glass, with the naira sign as the single touch of brand yellow.
export function ListingBody({ post, index, active, paused, onOpen, onLike }: BodyProps) {
  const d = post.listing;
  const type = post.listing_type ?? "product";
  const slides = slidesOf(post);
  const title = ((type === "business" ? d?.business_name : null) || post.caption || "").trim();
  const where = d?.location_info ? formatCompactLocation(d.location_info) : (d?.pickup_info || post.location || "");
  const cond = d?.condition ? COND[d.condition] : null;
  const prefix = PRICE_PREFIX[type];
  const sold = d?.status === "sold";
  const reserved = d?.status === "reserved";
  const closed = sold || reserved;
  const nego = d?.price_type === "negotiable" && !sold;
  const cta = CTA[type] ?? "View listing";

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
            {sold ? "Sold" : "Reserved"}
          </span>
        )}
        {d && (
          <Link
            href={`/l/${post.id}`}
            aria-label={`${cta}, ₦${d.formatted_price}${nego ? ", negotiable" : ""}`}
            className="group/price absolute bottom-3 left-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-pill border border-white/15 bg-black/55 py-1.5 pl-4 pr-1.5 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[transform,background-color] duration-150 hover:bg-black/65 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span className="flex min-w-0 items-baseline gap-1.5">
              {prefix && <span className="text-supporting font-medium text-white/65">{prefix}</span>}
              <span className={`truncate text-[17px] font-extrabold tracking-tight ${sold ? "text-white/55 line-through decoration-white/40" : ""}`}>
                <span className={`mr-0.5 text-[13px] font-bold ${sold ? "text-white/55" : "text-brand"}`}>₦</span>
                {d.formatted_price}
              </span>
            </span>
            {nego && (
              <span className="shrink-0 rounded-pill bg-white/15 px-2 py-0.5 text-micro font-semibold text-white/90">Nego</span>
            )}
            <span
              aria-hidden
              className={`grid size-8 shrink-0 place-items-center rounded-full transition-transform duration-150 group-hover/price:translate-x-0.5 motion-reduce:transition-none ${
                sold ? "bg-white/20 text-white" : "bg-white text-black"
              }`}
            >
              <Icon name="chevronRight" className="size-4" />
            </span>
          </Link>
        )}
      </ImageCarousel>

      {(TYPE_LABEL[type] || title || cond || where) && (
        <div className="mt-3">
          {TYPE_LABEL[type] && <p className="mb-1 text-micro font-bold uppercase tracking-wider text-muted">{TYPE_LABEL[type]}</p>}
          {title && <p className="line-clamp-2 text-label font-medium leading-snug text-fg">{title}</p>}
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
      )}
    </div>
  );
}
