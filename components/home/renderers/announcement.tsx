"use client";

import { formatWhen, structuredOf } from "@/lib/feed/structured";
import { TapSurface } from "./tap-surface";
import type { BodyProps } from "./types";

export function When({ label, iso }: { label: string; iso: string | null }) {
  if (!iso) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/[0.07] px-3 py-1.5 text-supporting font-semibold text-fg">
      <span className="text-muted">{label}</span>
      <span suppressHydrationWarning>{formatWhen(iso)}</span>
    </span>
  );
}

export function AnnouncementBody({ post, onOpen, onLike }: BodyProps) {
  const c = structuredOf(post);
  if (!c || c.kind !== "announcement") return null;
  const files = post.media.length;
  return (
    <TapSurface onOpen={onOpen} onLike={onLike} label="Open announcement" className="block rounded-image bg-surface-subtle p-5">
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-brand" />
        <span className="min-w-0 truncate text-micro font-semibold uppercase tracking-[0.08em] text-muted">
          Announcement{c.publisher ? ` · ${c.publisher.name}` : ""}
        </span>
      </span>
      <span className="mt-2 block text-[21px] font-extrabold leading-[1.2] tracking-tight text-fg">{c.title}</span>
      <span className="mt-2 line-clamp-4 block whitespace-pre-wrap text-body leading-[1.5] text-fg/80">{c.body}</span>
      {(c.event_at || c.deadline_at || files > 0) && (
        <span className="mt-3.5 flex flex-wrap gap-2">
          <When label="Event" iso={c.event_at} />
          <When label="Deadline" iso={c.deadline_at} />
          {files > 0 && (
            <span className="inline-flex items-center rounded-pill bg-white/[0.07] px-3 py-1.5 text-supporting font-semibold text-fg">
              {files} {files === 1 ? "attachment" : "attachments"}
            </span>
          )}
        </span>
      )}
    </TapSurface>
  );
}
