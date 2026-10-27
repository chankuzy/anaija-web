"use client";

import { frameAspect } from "@/lib/feed/content";
import { ImageCarousel, slidesOf } from "./image-carousel";
import type { BodyProps } from "./types";

// One image or a set that slides on its own. A post's own slideshow interval wins when it set one.
export function GalleryBody({ post, index, active, paused, onOpen, onLike }: BodyProps) {
  const interval = post.slideshow?.enabled ? Math.max(1800, post.slideshow.interval_ms || 3600) : 3600;
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
      label="Open post"
    />
  );
}
