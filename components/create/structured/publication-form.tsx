/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { hashtagsOf, type Visibility } from "@/lib/create/types";
import { isImageFile, useStructuredPublish } from "@/lib/create/structured";
import { useObjectUrl } from "@/lib/create/use-object-url";
import { AREA, Count, INPUT, Label, ToggleRow, VisibilityChips } from "./fields";
import { FormFrame } from "./frame";

type BlockType = "heading" | "paragraph" | "quote" | "list";
interface Block {
  id: string;
  type: BlockType;
  text: string;
}
const NAMES: Record<BlockType, string> = { heading: "Heading", paragraph: "Paragraph", quote: "Quote", list: "List" };
const HINT: Record<BlockType, string> = { heading: "Section heading", paragraph: "Write here…", quote: "A quote or key line", list: "One item per line" };
const block = (type: BlockType): Block => ({ id: crypto.randomUUID(), type, text: "" });

export function PublicationForm({ onClose }: { onClose: () => void }) {
  const pub = useStructuredPublish();
  const coverRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>(() => [block("paragraph")]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [allowComments, setAllowComments] = useState(true);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverUrl = useObjectUrl(cover);

  const set = (id: string, text: string) => setBlocks((p) => p.map((b) => (b.id === id ? { ...b, text } : b)));
  const move = (id: string, d: -1 | 1) =>
    setBlocks((p) => {
      const i = p.findIndex((b) => b.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const hasParagraph = blocks.some((b) => b.type === "paragraph" && b.text.trim());
  const problem = !headline.trim() ? "Add a headline" : !hasParagraph ? "Write at least one paragraph" : null;

  const submit = () =>
    void pub.run(cover ? [cover] : [], async (ctx) => {
      const out = blocks
        .map((b) =>
          b.type === "list"
            ? { type: "list", items: b.text.split("\n").map((s) => s.trim()).filter(Boolean) }
            : { type: b.type, text: b.text.trim() },
        )
        .filter((b) => ("items" in b ? (b.items?.length ?? 0) > 0 : b.text.length > 0));
      return {
        type: "post",
        subtype: "article",
        caption: headline.trim(),
        hashtags: hashtagsOf(`${headline} ${subtitle}`),
        visibility,
        allow_comments: allowComments,
        ...(cover ? { media: [await ctx.image(cover)] } : {}),
        content: { headline: headline.trim(), subtitle: subtitle.trim(), blocks: out },
      };
    });

  return (
    <FormFrame title="New publication" cta="Publish" ready={problem === null} hint={problem} dirty={!!headline.trim() || hasParagraph || !!cover} pub={pub} onSubmit={submit} onClose={onClose}>
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!isImageFile(f)) return setCoverError("The cover must be an image.");
          setCoverError(null);
          setCover(f);
        }}
      />

      <Label hint="Optional">Cover image</Label>
      {coverUrl ? (
        <div className="relative overflow-hidden rounded-image">
          <img src={coverUrl} alt="" className="aspect-[16/10] w-full object-cover" />
          <button type="button" aria-label="Remove cover" disabled={pub.busy} onClick={() => setCover(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white">
            <Icon name="close" className="size-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => coverRef.current?.click()} className="grid aspect-[16/7] w-full place-items-center rounded-[22px] bg-surface-subtle text-muted transition-colors hover:bg-surface-interactive">
          <span className="flex flex-col items-center gap-1.5 text-body font-bold text-fg">
            <Icon name="gallery" filled className="size-6" />
            Add a cover
          </span>
        </button>
      )}
      {coverError && <p role="alert" className="mt-2 text-secondary text-danger">{coverError}</p>}

      <Label>Headline</Label>
      <textarea className={`${AREA} min-h-[72px] text-[20px] font-bold`} placeholder="Headline" maxLength={140} value={headline} disabled={pub.busy} onChange={(e) => setHeadline(e.target.value.replace(/\n/g, " "))} />
      <Count n={headline.length} max={140} />

      <Label hint="Optional">Subtitle</Label>
      <input className={INPUT} placeholder="One line that sets it up" maxLength={200} value={subtitle} disabled={pub.busy} onChange={(e) => setSubtitle(e.target.value)} />

      <Label>Article</Label>
      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={b.id} className="rounded-2xl bg-surface-subtle p-3">
            <div className="mb-2 flex items-center gap-1">
              <span className="flex-1 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{NAMES[b.type]}</span>
              <button type="button" aria-label="Move up" disabled={pub.busy || i === 0} onClick={() => move(b.id, -1)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/8 disabled:opacity-30">
                <Icon name="chevronDown" className="size-4 rotate-180" />
              </button>
              <button type="button" aria-label="Move down" disabled={pub.busy || i === blocks.length - 1} onClick={() => move(b.id, 1)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/8 disabled:opacity-30">
                <Icon name="chevronDown" className="size-4" />
              </button>
              <button type="button" aria-label="Remove block" disabled={pub.busy || blocks.length === 1} onClick={() => setBlocks((p) => p.filter((x) => x.id !== b.id))} className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/8 disabled:opacity-30">
                <Icon name="close" className="size-4" />
              </button>
            </div>
            <textarea
              className={`w-full resize-none bg-transparent leading-[1.55] text-fg outline-none placeholder:text-muted [field-sizing:content] ${
                b.type === "heading" ? "min-h-[32px] text-[20px] font-extrabold" : b.type === "quote" ? "min-h-[48px] text-[17px] italic" : "min-h-[96px] text-[16px]"
              }`}
              placeholder={HINT[b.type]}
              maxLength={5000}
              value={b.text}
              disabled={pub.busy}
              onChange={(e) => set(b.id, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(NAMES) as BlockType[]).map((t) => (
          <button key={t} type="button" disabled={pub.busy || blocks.length >= 200} onClick={() => setBlocks((p) => [...p, block(t)])} className="inline-flex items-center gap-1.5 rounded-full bg-surface-interactive px-3.5 py-2 text-secondary font-bold text-fg">
            <Icon name="plus" className="size-4" />
            {NAMES[t]}
          </button>
        ))}
      </div>

      <VisibilityChips value={visibility} onChange={setVisibility} disabled={pub.busy} />
      <ToggleRow label="Allow comments" on={allowComments} onChange={setAllowComments} />
    </FormFrame>
  );
}
