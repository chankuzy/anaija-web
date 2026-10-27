"use client";

import { useRef, useState } from "react";
import { hashtagsOf, type Visibility } from "@/lib/create/types";
import { DOC_ACCEPT, MAX_DOC_BYTES, docMimeOf, isImageFile, useStructuredPublish } from "@/lib/create/structured";
import { useCapabilities } from "@/lib/create/use-capabilities";
import { AREA, Chip, Count, FileRow, INPUT, Label, ToggleRow, VisibilityChips } from "./fields";
import { FormFrame } from "./frame";

const MAX_FILES = 5;
const iso = (local: string) => (local ? new Date(local).toISOString() : null);

export function AnnouncementForm({ onClose }: { onClose: () => void }) {
  const pub = useStructuredPublish();
  const { caps } = useCapabilities();
  const fileRef = useRef<HTMLInputElement>(null);
  const publishers = caps?.publishers ?? [];
  const [chosen, setChosen] = useState<number | null>(null);
  const publisherId = chosen ?? publishers[0]?.id ?? null;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [allowComments, setAllowComments] = useState(true);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    let err: string | null = null;
    for (const f of list) {
      if (next.length >= MAX_FILES) { err = `Attach up to ${MAX_FILES} files.`; break; }
      if (!isImageFile(f) && !docMimeOf(f)) { err = "Attach images or PDF, Word, PowerPoint, Excel or text files."; continue; }
      if (!isImageFile(f) && f.size > MAX_DOC_BYTES) { err = "Documents can be up to 25 MB."; continue; }
      next.push(f);
    }
    setFileError(err);
    setFiles(next);
  };

  const problem = !publisherId ? "No publishing identity" : !title.trim() ? "Add a title" : !body.trim() ? "Write the announcement" : null;
  const submit = () =>
    void pub.run(files, async (ctx) => {
      const media = [];
      for (const f of files) media.push(isImageFile(f) ? await ctx.image(f) : await ctx.document(f, null));
      return {
        type: "post",
        subtype: "announcement",
        caption: title.trim(),
        hashtags: hashtagsOf(`${title} ${body}`),
        visibility,
        allow_comments: allowComments,
        ...(media.length ? { media } : {}),
        content: { title: title.trim(), body: body.trim(), event_at: iso(eventAt), deadline_at: iso(deadlineAt), publisher_id: publisherId },
      };
    });

  return (
    <FormFrame title="New announcement" cta="Publish announcement" ready={problem === null} hint={problem} dirty={!!title.trim() || !!body.trim() || files.length > 0} pub={pub} onSubmit={submit} onClose={onClose}>
      <input ref={fileRef} type="file" multiple accept={`image/*,${DOC_ACCEPT}`} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      <Label>Publishing as</Label>
      <div className="flex flex-wrap gap-2">
        {publishers.map((p) => (
          <Chip key={p.id} on={publisherId === p.id} disabled={pub.busy || publishers.length === 1} onClick={() => setChosen(p.id)}>
            {p.name}
          </Chip>
        ))}
      </div>

      <Label>Title</Label>
      <input className={INPUT} placeholder="What is this about?" maxLength={140} value={title} disabled={pub.busy} onChange={(e) => setTitle(e.target.value)} />

      <Label>Announcement</Label>
      <textarea className={`${AREA} min-h-[160px]`} placeholder="Write the details" maxLength={3000} value={body} disabled={pub.busy} onChange={(e) => setBody(e.target.value)} />
      <Count n={body.length} max={3000} />

      <Label hint="Optional">Event date</Label>
      <input type="datetime-local" className={INPUT} value={eventAt} disabled={pub.busy} onChange={(e) => setEventAt(e.target.value)} />
      <Label hint="Optional">Deadline</Label>
      <input type="datetime-local" className={INPUT} value={deadlineAt} disabled={pub.busy} onChange={(e) => setDeadlineAt(e.target.value)} />

      <Label hint={`Optional · up to ${MAX_FILES}`}>Attachments</Label>
      <div className="space-y-2">
        {files.map((f, i) => (
          <FileRow key={`${f.name}-${i}`} name={f.name} size={f.size} disabled={pub.busy} onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))} />
        ))}
      </div>
      {files.length < MAX_FILES && (
        <button type="button" disabled={pub.busy} onClick={() => fileRef.current?.click()} className="mt-2.5 rounded-full bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-fg">
          Add files
        </button>
      )}
      {fileError && <p role="alert" className="mt-2 text-secondary text-danger">{fileError}</p>}

      <VisibilityChips value={visibility} onChange={setVisibility} disabled={pub.busy} />
      <ToggleRow label="Allow comments" on={allowComments} onChange={setAllowComments} />
    </FormFrame>
  );
}
