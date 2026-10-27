/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PdfPager } from "@/components/document/pdf-pager";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { fileLabel, formatBytes, structuredOf } from "@/lib/feed/structured";
import type { BodyProps } from "./types";

const DocumentViewer = dynamic(() => import("@/components/document/document-viewer").then((m) => m.DocumentViewer), { ssr: false });

// Presentational: the reader and the composer preview draw this card.
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

export const docMedia = (post: Post) => post.media.find((m) => (m.type ?? "").toLowerCase() === "document");
export const isPdfUrl = (url: string | null | undefined) => !!url && /\.pdf($|[?#])/i.test(url);

// Formats with no in-app renderer (Office files need server-side conversion). Honest, not a fake preview.
function NoPreview({ coverUrl, label, name, size }: { coverUrl?: string | null; label: string; name: string; size?: number }) {
  return (
    <div className="flex items-center gap-4 rounded-image bg-surface-subtle p-4">
      <span className="relative grid h-[96px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-xl bg-card">
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
        <span className="block truncate text-secondary font-semibold text-fg">{name}</span>
        <span className="mt-0.5 block text-supporting font-semibold text-muted">{[label, formatBytes(size)].filter(Boolean).join(" · ")}</span>
        <span className="mt-2 block text-supporting leading-[1.4] text-muted">In-app preview isn&apos;t available for {label} files yet. You can get the original from the ⋯ menu.</span>
      </span>
    </div>
  );
}

// Swipeable PDF pages + the immersive zoom viewer. Used by documents and by PDF attachments on announcements.
export function PdfAttachment({ url, title, coverUrl }: { url: string; title: string; coverUrl?: string | null }) {
  const [at, setAt] = useState<number | null>(null);
  return (
    <>
      <PdfPager url={url} coverUrl={coverUrl} label="document" onOpen={setAt} />
      {at !== null && <DocumentViewer url={url} title={title} startPage={at} onClose={() => setAt(null)} />}
    </>
  );
}

export function DocumentPages({ post }: { post: Post }) {
  const c = structuredOf(post);
  if (!c || c.kind !== "document") return null;
  const m = docMedia(post);
  const label = fileLabel(c.file.mime, c.file.name);
  const isPdf = label === "PDF" && !!m?.url;
  return (
    <div>
      {isPdf && m?.url ? (
        <PdfAttachment url={m.url} title={c.title || "Document"} coverUrl={m.thumbnail} />
      ) : (
        <NoPreview coverUrl={m?.thumbnail} label={label} name={c.file.name} size={c.file.size} />
      )}
      {isPdf && <span className="mt-2 block text-supporting font-semibold text-muted">{[label, formatBytes(c.file.size)].filter(Boolean).join(" · ")}</span>}
    </div>
  );
}

export function DocumentBody({ post, onOpen }: BodyProps) {
  const c = structuredOf(post);
  if (!c || c.kind !== "document") return null;
  return (
    <div>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="block text-[18px] font-bold leading-[1.25] text-fg">{c.title || "Untitled document"}</span>
        {c.description ? <span className="mt-1 line-clamp-3 block text-secondary leading-[1.4] text-muted">{c.description}</span> : null}
      </button>
      <div className="mt-3">
        <DocumentPages post={post} />
      </div>
    </div>
  );
}
