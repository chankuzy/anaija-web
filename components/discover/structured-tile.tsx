"use client";

import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { fileLabel, structuredOf } from "@/lib/feed/structured";

const PLATE =
  "absolute inset-0 flex flex-col justify-between gap-2 bg-[linear-gradient(135deg,var(--color-card-alt),var(--color-card))] p-2.5 text-left md:p-3.5";
const KICKER = "text-micro font-bold uppercase tracking-[0.08em] text-brand";

// Compact preview of the structured kinds for grids (Discover, Profile).
// hasCover: the tile already shows a picture, so only a headline is laid over its bottom edge.
export function StructuredTile({ post, hasCover }: { post: Post; hasCover: boolean }) {
  const c = structuredOf(post);
  if (!c) return null;

  if (hasCover) {
    const title = c.kind === "poll" ? c.question : c.kind === "article" ? c.headline : c.title;
    return (
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-b from-transparent to-black/80 px-2.5 pb-2 pt-12 text-left">
        <span className={`line-clamp-3 block text-supporting font-bold leading-[1.25] text-white ${c.kind === "article" ? "font-serif" : ""}`}>{title}</span>
      </span>
    );
  }

  if (c.kind === "poll") {
    return (
      <span className={PLATE}>
        <span className={KICKER}>Poll</span>
        <span className="line-clamp-5 block text-[13px] font-bold leading-[1.3] text-fg md:text-[15px]">{c.question}</span>
        <span className="hidden flex-col gap-1 md:flex">
          {c.options.slice(0, 2).map((o) => (
            <span key={o.id} className="truncate rounded-full bg-white/10 px-2.5 py-1 text-micro font-semibold text-fg">
              {o.text}
            </span>
          ))}
        </span>
      </span>
    );
  }

  if (c.kind === "announcement") {
    return (
      <span className={PLATE}>
        <span className={KICKER}>Announcement</span>
        <span className="line-clamp-5 block text-[13px] font-bold leading-[1.3] text-fg md:text-[15px]">{c.title}</span>
        <span className="truncate text-micro font-semibold text-muted">{c.publisher?.name ?? ""}</span>
      </span>
    );
  }

  if (c.kind === "article") {
    return (
      <span className={PLATE}>
        <span className={KICKER}>Publication</span>
        <span className="line-clamp-6 block font-serif text-[15px] font-bold leading-[1.25] text-fg md:text-[18px]">{c.headline}</span>
        <span className="text-micro font-semibold text-muted">{c.read_minutes} min read</span>
      </span>
    );
  }

  return (
    <span className={PLATE}>
      <span className="flex items-center gap-1.5 text-muted">
        <Icon name="copy" filled className="size-5" />
        <span className="text-micro font-extrabold tracking-wide">{fileLabel(c.file.mime, c.file.name)}</span>
      </span>
      <span className="line-clamp-4 block text-[13px] font-bold leading-[1.3] text-fg md:text-[15px]">{c.title || "Untitled document"}</span>
    </span>
  );
}
