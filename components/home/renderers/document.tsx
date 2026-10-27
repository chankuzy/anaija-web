/* eslint-disable @next/next/no-img-element */
"use client";

import { Icon } from "@/components/ui/icon";
import { fileLabel, formatBytes, structuredOf } from "@/lib/feed/structured";
import type { BodyProps } from "./types";

// Presentational: the feed, the reader and the composer preview all draw the same card.
export function DocumentCardView({
  title,
  description,
  fileName,
  sizeBytes,
  mime,
  coverUrl,
  onOpen,
  large = false,
}: {
  title: string;
  description?: string;
  fileName?: string;
  sizeBytes?: number;
  mime?: string;
  coverUrl?: string | null;
  onOpen?: () => void;
  large?: boolean;
}) {
  const label = fileLabel(mime, fileName);
  const meta = [label, formatBytes(sizeBytes)].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-card ${large ? "h-[132px] w-[104px]" : "h-[84px] w-[66px]"}`}>
        {coverUrl ? (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-muted">
            <Icon name="copy" filled className="size-6" />
            <span className="text-micro font-extrabold tracking-wide">{label}</span>
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-bold leading-[1.25] text-fg ${large ? "text-[22px]" : "line-clamp-2 text-[16px]"}`}>{title || "Untitled document"}</span>
        {description ? (
          <span className={`mt-1 block text-secondary leading-[1.4] text-muted ${large ? "whitespace-pre-wrap" : "line-clamp-2"}`}>{description}</span>
        ) : null}
        {meta && <span className="mt-1.5 block text-supporting font-semibold text-muted">{meta}</span>}
      </span>
    </>
  );
  const cls = "flex w-full items-start gap-3.5 text-left";
  return onOpen ? (
    <button type="button" onClick={onOpen} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export const docMedia = (post: BodyProps["post"]) => post.media.find((m) => (m.type ?? "").toLowerCase() === "document");

export function OpenDocument({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex h-11 items-center justify-center rounded-pill bg-brand text-secondary font-extrabold text-brand-fg transition active:scale-[0.99]"
    >
      Open document
    </a>
  );
}

export function DocumentBody({ post, onOpen }: BodyProps) {
  const c = structuredOf(post);
  if (!c || c.kind !== "document") return null;
  const m = docMedia(post);
  return (
    <div className="rounded-image bg-surface-subtle p-4">
      <DocumentCardView title={c.title} description={c.description} fileName={c.file.name} sizeBytes={c.file.size} mime={c.file.mime} coverUrl={m?.thumbnail} onOpen={onOpen} />
      <OpenDocument url={m?.url} />
    </div>
  );
}
