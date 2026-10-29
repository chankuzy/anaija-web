/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { DocumentCardView } from "@/components/home/renderers/document";
import { Icon } from "@/components/ui/icon";
import { renderPdfCover } from "@/lib/documents/cover";
import { hashtagsOf, type Visibility } from "@/lib/create/types";
import { DOC_ACCEPT, MAX_DOC_BYTES, docMimeOf, isImageFile, useStructuredPublish } from "@/lib/create/structured";
import { useObjectUrl } from "@/lib/create/use-object-url";
import { AREA, Count, FileRow, INPUT, Label, ToggleRow, VisibilityChips } from "./fields";
import { FormFrame } from "./frame";

export function DocumentForm({ onClose }: { onClose: () => void }) {
  const pub = useStructuredPublish();
  const docRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const current = useRef<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null); // chosen by the user
  const [auto, setAuto] = useState<File | null>(null); // rendered from page 1 of a PDF
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [allowComments, setAllowComments] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const effective = cover ?? auto;
  const coverUrl = useObjectUrl(effective);

  const pickDoc = (f: File | undefined) => {
    if (!f) return;
    if (!docMimeOf(f)) return setFileError("Use a PDF, Word, PowerPoint, Excel or text file.");
    if (f.size > MAX_DOC_BYTES) return setFileError("This file is larger than 25 MB.");
    setFileError(null);
    setFile(f);
    setAuto(null);
    current.current = f;
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, "").slice(0, 120));
    if (docMimeOf(f) === "application/pdf") {
      void renderPdfCover(f).then((c) => {
        if (c && current.current === f) setAuto(c);
      });
    }
  };
  const removeDoc = () => {
    current.current = null;
    setFile(null);
    setAuto(null);
  };
  const pickCover = (f: File | undefined) => {
    if (!f) return;
    if (!isImageFile(f)) return setFileError("The cover must be an image.");
    setFileError(null);
    setCover(f);
  };

  const problem = !file ? "Choose a document" : !title.trim() ? "Add a title" : null;
  const submit = () => {
    if (!file) return;
    void pub.run([file, ...(effective ? [effective] : [])], async (ctx) => ({
      type: "post",
      subtype: "document",
      caption: title.trim(),
      hashtags: hashtagsOf(description),
      visibility,
      allow_comments: allowComments,
      media: [await ctx.document(file, effective)],
      content: { title: title.trim(), description: description.trim(), file: { name: file.name } },
    }));
  };

  return (
    <FormFrame title="New document" cta="Share document" ready={problem === null} hint={problem} dirty={!!file || !!title.trim()} pub={pub} onSubmit={submit} onClose={onClose}>
      <input ref={docRef} type="file" accept={DOC_ACCEPT} hidden onChange={(e) => { pickDoc(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />

      <Label hint="PDF, Word, PowerPoint, Excel, text · up to 25 MB">File</Label>
      {file ? (
        <FileRow name={file.name} size={file.size} disabled={pub.busy} onRemove={removeDoc} />
      ) : (
        <button type="button" onClick={() => docRef.current?.click()} className="flex h-[112px] w-full flex-col items-center justify-center gap-2 rounded-[22px] bg-surface-subtle text-muted transition-colors hover:bg-surface-interactive">
          <Icon name="copy" filled className="size-7 text-fg" />
          <span className="text-body font-bold text-fg">Choose a document</span>
        </button>
      )}
      {fileError && <p role="alert" className="mt-2 text-secondary text-danger">{fileError}</p>}

      <Label>Title</Label>
      <input className={INPUT} placeholder="Give it a clear title" maxLength={120} value={title} disabled={pub.busy} onChange={(e) => setTitle(e.target.value)} />

      <Label hint="Optional">Description</Label>
      <textarea className={`${AREA} min-h-[96px]`} placeholder="What is inside?" maxLength={500} value={description} disabled={pub.busy} onChange={(e) => setDescription(e.target.value)} />
      <Count n={description.length} max={500} />

      <Label hint={!cover && auto ? "Taken from page 1" : "Optional"}>Cover image</Label>
      <div className="flex items-center gap-3">
        <button type="button" disabled={pub.busy} onClick={() => coverRef.current?.click()} className="rounded-full bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-fg">
          {effective ? "Replace cover" : "Add cover"}
        </button>
        {cover && (
          <button type="button" disabled={pub.busy} onClick={() => setCover(null)} className="text-secondary font-semibold text-muted">
            {auto ? "Use page 1" : "Remove"}
          </button>
        )}
      </div>

      <Label>Preview</Label>
      <div className="rounded-image bg-surface-subtle p-4">
        <DocumentCardView title={title.trim()} description={description.trim()} fileName={file?.name} sizeBytes={file?.size} mime={file ? (docMimeOf(file) ?? undefined) : undefined} coverUrl={coverUrl} />
      </div>

      <VisibilityChips value={visibility} onChange={setVisibility} disabled={pub.busy} />
      <ToggleRow label="Allow comments" on={allowComments} onChange={setAllowComments} />
    </FormFrame>
  );
}
