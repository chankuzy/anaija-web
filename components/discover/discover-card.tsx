/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import type { DiscoverItem } from "@/lib/api/discover";
import { KIND_META } from "@/lib/create/kinds";
import { coverOf, imageCount, tileAspect, videoSrcOf } from "@/lib/discover/tile";
import { isReelEligible } from "@/lib/feed/content";
import { structuredOf } from "@/lib/feed/structured";
import { BagGlyph, ClapperboardGlyph, LayersGlyph, PlayGlyph } from "./glyphs";
import { StructuredTile } from "./structured-tile";

export type VideoBadge = "play" | "clapper";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`icon-shadow absolute z-[2] grid place-items-center text-white ${className}`}>{children}</span>
  );
}

// Shown when a tile has no thumbnail (or it fails to load) and no caption, so a tile is never blank.
function Fallback({ icon }: { icon: IconName }) {
  return (
    <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#26211c,#141416)] text-white/35">
      <Icon name={icon} filled className="size-9" />
    </span>
  );
}

function TileMedia({ url, caption, fallback }: { url: string | null; caption: string; fallback: IconName }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
    );
  }
  if (!url && caption) {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--color-card-alt),var(--color-card))] p-2.5 text-center">
        <span className="line-clamp-7 text-supporting font-medium leading-[1.35] text-fg">{caption}</span>
      </span>
    );
  }
  return <Fallback icon={fallback} />;
}

// Muted, looping preview. Mounted only while this tile is the one playing, so idle tiles cost nothing.
function TilePreview({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onPlaying={() => setReady(true)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}

const HeartGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-[19px]" fill="currentColor" aria-hidden="true">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

// Content-aware tile: media posts keep their thumbnail; polls, announcements, publications and documents get a
// native preview (cover + headline when there is a cover, a typographic tile when there is not).
// Video tiles report visibility and hover to the grid, which decides which one plays.
export function DiscoverCard({
  item,
  onOpen,
  videoBadge = "play",
  playing = false,
  onVisible,
  onHover,
}: {
  item: DiscoverItem;
  onOpen: () => void;
  videoBadge?: VideoBadge;
  playing?: boolean;
  onVisible?: (id: string, visible: boolean) => void;
  onHover?: (id: string | null) => void;
}) {
  const post = item.post;
  const cover = coverOf(post);
  const isListing = item.kind === "listing";
  const structured = structuredOf(post);
  const hasImage = !!cover.url;
  const aspect = tileAspect(cover.aspect, isListing ? true : hasImage);
  const multi = imageCount(post) > 1;
  const audioReel = !cover.isVideo && isReelEligible(post);
  const caption = (post.caption ?? "").trim();
  const price = post.listing?.formatted_price;
  const fallback: IconName = isListing ? "bag" : cover.isVideo ? "clapperboard" : "gallery";
  const videoSrc = cover.isVideo ? videoSrcOf(post) : null;

  const ref = useRef<HTMLButtonElement>(null);
  const id = item.id;
  useEffect(() => {
    const el = ref.current;
    if (!el || !videoSrc || !onVisible) return;
    const io = new IntersectionObserver((es) => onVisible(id, es[0]?.isIntersecting ?? false), { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      onVisible(id, false);
    };
  }, [id, videoSrc, onVisible]);

  const hoverProps = videoSrc
    ? {
        onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && onHover?.(id),
        onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && onHover?.(null),
      }
    : {};

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      {...hoverProps}
      className="group relative block w-full overflow-hidden bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/80 focus-visible:ring-inset"
      style={{ aspectRatio: String(aspect), backgroundColor: cover.color ?? undefined }}
    >
      {structured && !hasImage ? (
        <StructuredTile post={post} hasCover={false} />
      ) : (
        <TileMedia key={cover.url ?? "none"} url={cover.url ?? null} caption={caption} fallback={fallback} />
      )}
      {structured && hasImage && <StructuredTile post={post} hasCover />}
      {playing && videoSrc && <TilePreview key={videoSrc} src={videoSrc} />}

      {isListing && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-black/55" />}

      {/* Hover: soft dim with counts, Instagram-style */}
      <span className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center gap-5 bg-black/0 text-[15px] font-bold text-white opacity-0 transition duration-200 group-hover:bg-black/35 group-hover:opacity-100">
        <span className="flex items-center gap-1.5 drop-shadow">
          <HeartGlyph />
          {compact.format(post.likes_count ?? 0)}
        </span>
        <span className="flex items-center gap-1.5 drop-shadow">
          <Icon name="message" filled className="size-[19px]" />
          {compact.format(post.comments_count ?? 0)}
        </span>
      </span>

      {isListing && (
        <Badge className="left-2 top-2">
          <BagGlyph className="size-[22px]" />
        </Badge>
      )}
      {structured ? (
        <Badge className="right-2 top-2">
          <Icon name={KIND_META[structured.kind].icon} filled className="size-[22px]" />
        </Badge>
      ) : cover.isVideo ? (
        <Badge className="right-2 top-2">
          {videoBadge === "clapper" ? <ClapperboardGlyph className="size-[22px]" /> : <PlayGlyph className="size-[22px]" />}
        </Badge>
      ) : audioReel ? (
        <Badge className="right-2 top-2">
          <Icon name="musicNote" filled className="size-[22px]" />
        </Badge>
      ) : (
        multi && (
          <Badge className="right-2 top-2">
            <LayersGlyph className="size-[22px]" />
          </Badge>
        )
      )}

      {isListing && price && (
        <span className="absolute bottom-2 right-2 z-[2] max-w-[calc(100%-16px)] truncate rounded-full bg-black/65 px-2.5 py-[3px] text-micro font-bold text-white">
          ₦{price}
        </span>
      )}
    </button>
  );
}
