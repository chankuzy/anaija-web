"use client";

import { Icon } from "@/components/ui/icon";
import { structuredOf } from "@/lib/feed/structured";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

// Course Desk question card. Opening it shows the answers in the comments sheet (see HomePost).
export function QuestionBody({ post, onOpen, onLike }: BodyProps) {
  const c = structuredOf(post);
  if (!c || c.kind !== "question") return null;
  const n = post.comments_count;
  const resolved = !!c.resolved_at;
  const pics = post.media.filter((m) => m.type === "image" && (m.thumbnail || m.url)).slice(0, 4);
  return (
    <TapSurface onOpen={onOpen} onLike={onLike} label="Open question" className="block rounded-image bg-surface-subtle p-5">
      <span className="flex items-center gap-2">
        <Icon name="questionCircle" filled className="size-4 text-brand-ink" />
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">Question</span>
        {resolved && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-brand/15 px-2.5 py-1 text-micro font-extrabold uppercase tracking-wide text-brand-ink">
            <Icon name="check" className="size-3" />
            Answered
          </span>
        )}
      </span>
      <span className="mt-2 block text-[19px] font-extrabold leading-[1.25] tracking-tight text-fg">{c.title}</span>
      {c.body ? (
        <span className="mt-2 line-clamp-4 block whitespace-pre-wrap text-body leading-[1.5] text-fg/80">{c.body}</span>
      ) : null}
      {pics.length > 0 && (
        <span className={`mt-3 grid gap-1.5 ${pics.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {pics.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={(m.thumbnail || m.url) as string}
              alt=""
              loading="lazy"
              className={`w-full rounded-2xl object-cover ${pics.length === 1 ? "max-h-72" : "aspect-square"}`}
            />
          ))}
        </span>
      )}
      <span className="mt-3.5 flex items-center gap-2.5">
        <span className="inline-flex items-center rounded-pill bg-surface-interactive px-3 py-1.5 text-supporting font-semibold text-fg">
          {n === 0 ? "No answers yet" : n === 1 ? "1 answer" : `${n} answers`}
        </span>
        <span className="text-supporting font-semibold text-brand-ink">{n === 0 ? "Be the first to answer" : "View answers"}</span>
      </span>
    </TapSurface>
  );
}
