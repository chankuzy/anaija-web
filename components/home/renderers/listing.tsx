/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { frameAspect, isImageMedia, sortedMedia } from "@/lib/feed/content";
import { sizedImage, useNetProfile } from "@/lib/feed/net";
import { formatCompactLocation } from "@/lib/location/types";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

const COND: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair", poor: "Poor" };
const TYPE_LABEL: Record<string, string> = { service: "Service", business: "Business", rental: "Rental", wanted: "Wanted" };
const PRICE_PREFIX: Record<string, string> = { service: "From", business: "From", wanted: "Budget" };
const CTA: Record<string, string> = { service: "View service", business: "View business", wanted: "See request", rental: "View rental" };

// Marketplace: the product leads. Image, then price, title and where, then a single clear action.
export function ListingBody({ post, index, onOpen, onLike }: BodyProps) {
  const d = post.listing;
  const type = post.listing_type ?? "product";
  const profile = useNetProfile();
  const images = sortedMedia(post).filter(isImageMedia);
  const raw = images[0]?.url ?? images[0]?.thumbnail ?? post.thumbnail_url;
  const src = raw ? sizedImage(raw, profile) : null;
  const title = ((type === "business" ? d?.business_name : null) || post.caption || "").trim();
  const where = d?.location_info ? formatCompactLocation(d.location_info) : (d?.pickup_info || post.location || "");
  const cond = d?.condition ? COND[d.condition] : null;
  const prefix = PRICE_PREFIX[type];
  const closed = d?.status === "sold" || d?.status === "reserved";

  return (
    <div>
      <div className="relative overflow-hidden rounded-image bg-surface-subtle" style={{ aspectRatio: Math.min(frameAspect("gallery", post), 1.25) }}>
        <TapSurface onOpen={onOpen} onLike={onLike} label="Open listing" className="absolute inset-0">
          {src ? (
            <img
              src={src}
              alt=""
              decoding="async"
              loading={index < 2 ? "eager" : "lazy"}
              draggable={false}
              className={`h-full w-full object-cover ${closed ? "opacity-70" : ""}`}
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-white/35">
              <Icon name="bag" filled className="size-10" />
            </span>
          )}
        </TapSurface>
        {closed && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-pill bg-black/70 px-3 py-1 text-micro font-bold uppercase tracking-wide text-white">
            {d?.status === "sold" ? "Sold" : "Reserved"}
          </span>
        )}
        {images.length > 1 && (
          <span className="pointer-events-none absolute right-3 top-3 rounded-pill bg-black/55 px-2.5 py-1 text-micro font-semibold text-white">
            +{images.length - 1}
          </span>
        )}
      </div>

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
