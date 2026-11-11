"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { makePreview, normalizeImage } from "@/lib/create/image-pipeline";
import { isImageFile, useStructuredPublish } from "@/lib/create/structured";
import { hashtagsOf } from "@/lib/create/types";
import { AREA, Count, Label } from "./fields";
import { FormFrame } from "./frame";

const TITLE_MAX = 140;
const BODY_MAX = 3000;
const MAX_IMAGES = 4; // server: LIMITS.qaImages
const MAX_SOURCE_BYTES = 30 * 1024 * 1024; // the original; what is uploaded is the compressed feed copy (server cap 10 MB)
const looksLikeImage = (f: File) => isImageFile(f) || /\.(heic|heif)$/i.test(f.name);

interface Pic {
  id: string;
  file: File; // the normalised File: a stable key, so a retry never uploads it twice
  url: string; // light preview, never the original
}

// Course Desk question: a short title, optional details and up to 4 images. Replies are comments. The server rejects
// questions outside a Course Desk, so this form is only reachable with ?community=<desk slug>.
export function QuestionForm({ onClose }: { onClose: () => void }) {
  const pub = useStructuredPublish();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pics, setPics] = useState<Pic[]>([]);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const live = useRef<Pic[]>([]);
  live.current = pics;

  useEffect(
    () => () => {
      for (const p of live.current) URL.revokeObjectURL(p.url);
    },
    [],
  );

  async function add(list: FileList | null) {
    if (!list || !list.length) return;
    setErr(null);
    const room = MAX_IMAGES - live.current.length;
    const picked = [...list];
    if (picked.length > room) setErr(`You can attach up to ${MAX_IMAGES} images.`);
    setReading(true);
    const next: Pic[] = [];
    try {
      for (const f of picked.slice(0, Math.max(0, room))) {
        if (!looksLikeImage(f)) {
          setErr("Only images can be attached.");
          continue;
        }
        if (f.size > MAX_SOURCE_BYTES) {
          setErr("An image is larger than 30 MB.");
          continue;
        }
        try {
          const file = await normalizeImage(f);
          const prev = await makePreview(file);
          next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(prev.blob) });
        } catch {
          setErr("One of the images couldn't be read.");
        }
      }
    } finally {
      setReading(false);
    }
    if (next.length) setPics((p) => [...p, ...next].slice(0, MAX_IMAGES));
  }

  function remove(id: string) {
    setPics((p) => {
      const hit = p.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return p.filter((x) => x.id !== id);
    });
  }

  const problem = !title.trim() ? "Ask your question in a few words" : reading ? "Preparing your images…" : null;

  const submit = () =>
    void pub.run(
      pics.map((p) => p.file),
      async (ctx) => {
        const media = [];
        for (const p of pics) media.push(await ctx.image(p.file));
        return {
          type: "post",
          subtype: "question",
          caption: title.trim(),
          hashtags: hashtagsOf(`${title} ${body}`),
          visibility: "public",
          allow_comments: true,
          ...(media.length ? { media } : {}),
          content: { title: title.trim(), body: body.trim() },
        };
      },
      "?tab=posts&filter=discussions",
    );

  return (
    <FormFrame
      title="Ask a question"
      cta="Post question"
      ready={problem === null}
      hint={problem}
      dirty={!!title.trim() || !!body.trim() || pics.length > 0}
      pub={pub}
      onSubmit={submit}
      onClose={onClose}
    >
      <Label>Question</Label>
      <textarea
        className={`${AREA} min-h-[84px]`}
        placeholder="What do you want to ask?"
        maxLength={TITLE_MAX}
        value={title}
        disabled={pub.busy}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Count n={title.length} max={TITLE_MAX} />

      <Label hint="Optional">Details</Label>
      <textarea
        className={`${AREA} min-h-[140px]`}
        placeholder="Add anything that helps someone answer: the topic, the page, what you already tried."
        maxLength={BODY_MAX}
        value={body}
        disabled={pub.busy}
        onChange={(e) => setBody(e.target.value)}
      />
      <Count n={body.length} max={BODY_MAX} />

      <Label hint={`Optional · up to ${MAX_IMAGES}`}>Images</Label>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-4 gap-2.5">
        {pics.map((p, i) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl bg-surface-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Attachment ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label={`Remove image ${i + 1}`}
              disabled={pub.busy}
              onClick={() => remove(p.id)}
              className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/65 text-white disabled:opacity-50"
            >
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
        ))}
        {pics.length < MAX_IMAGES && (
          <button
            type="button"
            aria-label="Add images"
            disabled={pub.busy || reading}
            onClick={() => input.current?.click()}
            className="grid aspect-square place-items-center rounded-2xl bg-surface-subtle text-muted hover:bg-surface-interactive disabled:opacity-50"
          >
            {reading ? <span className="size-5 animate-spin rounded-full border-2 border-muted border-t-transparent" /> : <Icon name="plus" className="size-6" />}
          </button>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-2 text-secondary text-danger">
          {err}
        </p>
      )}
    </FormFrame>
  );
}
