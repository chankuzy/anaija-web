/* eslint-disable @next/next/no-img-element */
"use client";

import { isImageMedia } from "@/lib/feed/content";
import { structuredOf } from "@/lib/feed/structured";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

export function PublicationBody({ post, onOpen, onLike }: BodyProps) {
  const c = structuredOf(post);
  if (!c || c.kind !== "article") return null;
  const cover = post.media.find(isImageMedia)?.url;
  return (
    <TapSurface onOpen={onOpen} onLike={onLike} label="Read publication" className="block overflow-hidden rounded-image bg-surface-subtle">
      {cover && <img src={cover} alt="" draggable={false} className="aspect-[16/10] w-full object-cover" />}
      <span className="block px-5 pb-5 pt-4">
        <span className="block text-micro font-semibold uppercase tracking-[0.08em] text-muted">Publication · {c.read_minutes} min read</span>
        <span className="mt-1.5 block text-[22px] font-extrabold leading-[1.2] tracking-tight text-fg">{c.headline}</span>
        {c.subtitle && <span className="mt-1.5 line-clamp-2 block text-body leading-[1.45] text-muted">{c.subtitle}</span>}
      </span>
    </TapSurface>
  );
}
