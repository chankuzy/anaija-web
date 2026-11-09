"use client";

import { Icon } from "@/components/ui/icon";
import { structuredOf } from "@/lib/feed/structured";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

// Course Desk question card. Opening it shows the replies in the comments sheet (see HomePost).
export function QuestionBody({ post, onOpen, onLike }: BodyProps) {
  const c = structuredOf(post);
  if (!c || c.kind !== "question") return null;
  const n = post.comments_count;
  return (
    <TapSurface onOpen={onOpen} onLike={onLike} label="Open question" className="block rounded-image bg-surface-subtle p-5">
      <span className="flex items-center gap-2">
        <Icon name="questionCircle" filled className="size-4 text-brand-ink" />
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">Question</span>
      </span>
      <span className="mt-2 block text-[19px] font-extrabold leading-[1.25] tracking-tight text-fg">{c.title}</span>
      {c.body ? (
        <span className="mt-2 line-clamp-4 block whitespace-pre-wrap text-body leading-[1.5] text-fg/80">{c.body}</span>
      ) : null}
      <span className="mt-3.5 flex items-center gap-2.5">
        <span className="inline-flex items-center rounded-pill bg-surface-interactive px-3 py-1.5 text-supporting font-semibold text-fg">
          {n === 0 ? "No answers yet" : n === 1 ? "1 answer" : `${n} answers`}
        </span>
        <span className="text-supporting font-semibold text-brand-ink">{n === 0 ? "Be the first to answer" : "View answers"}</span>
      </span>
    </TapSurface>
  );
}
