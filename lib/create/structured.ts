"use client";

// Publishing for the structured kinds (document, poll, publication, announcement). Uses the same upload endpoint
// (uploadBlob), image pipeline and posts-store contract as the media composer; only the body differs.
// Uploaded files are remembered per File, so a retry after a failed save never uploads twice.
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { publishApi, type MediaInput } from "@/lib/api/publish";
import { uploadBlob } from "@/lib/api/upload";
import { prepareImage } from "./image-pipeline";

export const MAX_DOC_BYTES = 25 * 1024 * 1024;
export const DOC_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
};
export const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
const extOf = (n: string) => (n.includes(".") ? (n.split(".").pop() ?? "") : "").toLowerCase();

/** MIME the server accepts for this file, or null when it is not a supported document. */
export function docMimeOf(f: File): string | null {
  const byExt = DOC_TYPES[extOf(f.name)];
  if (byExt) return byExt;
  return Object.values(DOC_TYPES).includes(f.type) ? f.type : null;
}
export const isImageFile = (f: File) => f.type.startsWith("image/");

export interface PublishCtx {
  image: (file: File) => Promise<MediaInput>;
  document: (file: File, cover: File | null) => Promise<MediaInput>;
}
type Stage = "idle" | "preparing" | "uploading" | "saving";

export function useStructuredPublish() {
  const router = useRouter();
  const [requestId] = useState(() => crypto.randomUUID());
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const images = useRef(new WeakMap<File, MediaInput>());
  const docKeys = useRef(new WeakMap<File, string>());

  /** `files` = everything build() may upload; only used to scale the progress bar. */
  const run = useCallback(
    async (files: File[], build: (ctx: PublishCtx) => Promise<Record<string, unknown>>) => {
      if (stage !== "idle") return;
      setError(null);
      setProgress(0);
      setStage("preparing");
      const total = files.reduce((n, f) => n + f.size, 0) || 1;
      const sent = new Map<File, number>();
      const mark = (f: File, n: number) => {
        sent.set(f, n);
        setProgress(Math.min(1, [...sent.values()].reduce((a, b) => a + b, 0) / total));
      };

      const ctx: PublishCtx = {
        image: async (file) => {
          const hit = images.current.get(file);
          if (hit) {
            mark(file, file.size);
            return hit;
          }
          setStage("preparing");
          const p = await prepareImage(file);
          setStage("uploading");
          const key = await uploadBlob(p.feed, `feed.${p.ext}`, p.contentType, (n) => mark(file, (n / p.feed.size) * file.size));
          const m: MediaInput = {
            type: "image",
            storage_key: key,
            width: p.width,
            height: p.height,
            aspect_ratio: p.width / p.height,
            size_bytes: p.feed.size,
            mime_type: p.contentType,
          };
          images.current.set(file, m);
          mark(file, file.size);
          return m;
        },
        document: async (file, cover) => {
          const mime = docMimeOf(file);
          if (!mime) throw new Error("This file type is not supported.");
          let key = docKeys.current.get(file);
          if (!key) {
            setStage("uploading");
            key = await uploadBlob(file, `document.${extOf(file.name) || "bin"}`, mime, (n) => mark(file, n));
            docKeys.current.set(file, key);
          }
          mark(file, file.size);
          const thumb = cover ? await ctx.image(cover) : null;
          return {
            type: "document",
            storage_key: key,
            ...(thumb ? { thumbnail_key: thumb.storage_key } : {}),
            size_bytes: file.size,
            mime_type: mime,
          };
        },
      };

      try {
        const body = await build(ctx);
        setStage("saving");
        const community = new URLSearchParams(window.location.search).get("community");
        const res = await publishApi.store({ ...body, ...(community ? { community } : {}), client_request_id: requestId });
        router.replace(community ? `/c/${encodeURIComponent(community)}` : `/p/${res.post_id}`);
      } catch (e) {
        setStage("idle");
        setProgress(0);
        if (e instanceof ApiError && e.errors) setError(Object.values(e.errors).map(String).join(" "));
        else setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    },
    [stage, requestId, router],
  );

  return { run, stage, progress, error, busy: stage !== "idle" };
}
export type StructuredPublish = ReturnType<typeof useStructuredPublish>;
