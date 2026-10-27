"use client";

import { Icon } from "@/components/ui/icon";
import { frameAspect } from "@/lib/feed/content";
import { ImageCarousel, slidesOf } from "./image-carousel";
import type { BodyProps } from "./types";

// An image reel (images + playable audio). In Home it is a silent, sliding gallery with an audio badge;
// tapping opens the Immersive reels surface, where the audio plays.
export function AudioReelBody({ post, index, active, paused, onOpen, onLike }: BodyProps) {
  const interval = post.slideshow?.enabled ? Math.max(1800, post.slideshow.interval_ms || 3600) : 3600;
  const name = post.audio?.name?.trim();
  return (
    <ImageCarousel
      slides={slidesOf(post)}
      aspect={frameAspect("gallery", post)}
      index={index}
      active={active}
      paused={paused}
      intervalMs={interval}
      onOpen={onOpen}
      onLike={onLike}
      label="Open reel"
    >
      <span className="pointer-events-none absolute left-3 top-3 inline-flex max-w-[70%] items-center gap-1.5 rounded-pill bg-black/55 py-1 pl-2 pr-2.5 text-micro font-semibold text-white">
        <Icon name="musicNote" filled className="size-3.5 shrink-0" />
        <span className="truncate">{name || "Reel"}</span>
      </span>
    </ImageCarousel>
  );
}
