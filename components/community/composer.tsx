"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Group, Toggle } from "@/components/settings/settings-kit";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { uploadBlob } from "@/lib/api/upload";
import { prepareImage } from "@/lib/create/image-pipeline";
import { AREA, Chip, Label, Sheet, messageOf } from "./kit";

export type ComposeMode = "post" | "announcement" | "poll";
const CLOSES: [string, number | null][] = [["No end", null], ["1 day", 24], ["3 days", 72], ["7 days", 168]];

export function ComposerSheet({ c, start, onClose, onDone }: { c: CommunityDetail; start: ComposeMode; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<ComposeMode>(start);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [important, setImportant] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [closes, setCloses] = useState<number | null>(72);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const modes: [ComposeMode, string][] = [];
  if (c.can.post) modes.push(["post", "Post"], ["poll", "Poll"]);
  if (c.can.announce) modes.push(["announcement", "Announcement"]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready =
    mode === "post" ? !!text.trim() || files.length > 0
    : mode === "announcement" ? !!title.trim() && !!text.trim()
    : !!text.trim() && filled.length >= 2;

  async function submit() {
    if (!ready || busy) return;
    setBusy("Publishing…");
    setErr(null);
    try {
      let body: Record<string, unknown>;
      if (mode === "post") {
        const media = [];
        for (let i = 0; i < files.length; i++) {
          setBusy(`Uploading ${i + 1} of ${files.length}…`);
          const p = await prepareImage(files[i]);
          const key = await uploadBlob(p.feed, `feed.${p.ext}`, p.contentType);
          media.push({ type: "image", storage_key: key, width: p.width, height: p.height, aspect_ratio: p.width / p.height, size_bytes: p.feed.size, mime_type: p.contentType });
        }
        body = { type: "post", caption: text.trim(), media, allow_comments: true };
      } else if (mode === "announcement") {
        body = { type: "post", subtype: "announcement", content: { title: title.trim(), body: text.trim(), priority: important ? "important" : "normal" } };
      } else {
        body = {
          type: "post", subtype: "poll",
          content: { question: text.trim(), options: filled, multiple, closes_at: closes ? new Date(Date.now() + closes * 3_600_000).toISOString() : null },
        };
      }
      await communitiesApi.post(c.id, { ...body, client_request_id: requestId });
      onDone();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(null);
    }
  }

  return (
    <Sheet title="Share with the community" onClose={onClose} wide>
      {modes.length > 1 && (
        <div className="flex gap-2 pb-1">
          {modes.map(([id, label]) => (
            <Chip key={id} active={mode === id} disabled={!!busy} onClick={() => setMode(id)}>{label}</Chip>
          ))}
        </div>
      )}

      {mode === "announcement" && (
        <>
          <Label>Title</Label>
          <input className={inputClass} maxLength={140} placeholder="What's the announcement?" value={title} disabled={!!busy} onChange={(e) => setTitle(e.target.value)} />
        </>
      )}

      <Label>{mode === "poll" ? "Question" : mode === "announcement" ? "Message" : "What's happening?"}</Label>
      <textarea className={AREA} maxLength={mode === "announcement" ? 3000 : 2000} value={text} disabled={!!busy} onChange={(e) => setText(e.target.value)} placeholder={mode === "poll" ? "Ask the class something" : "Write something"} />

      {mode === "post" && (
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 4)); e.target.value = ""; }} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy || files.length >= 4} onClick={() => fileRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg disabled:opacity-50">
              <Icon name="gallery" className="size-4" />
              Add photos
            </button>
            {files.map((f, i) => (
              <button key={`${f.name}-${i}`} type="button" disabled={!!busy} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="inline-flex h-9 max-w-[180px] items-center gap-1.5 rounded-full bg-surface-interactive px-3 text-supporting font-semibold text-muted">
                <span className="truncate">{f.name}</span>
                <Icon name="close" className="size-3.5 shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "announcement" && (
        <div className="mt-4">
          <Group>
            <Toggle icon="pin" label="Important (pins to the top, alerts members)" value={important} onChange={setImportant} />
          </Group>
        </div>
      )}

      {mode === "poll" && (
        <>
          <Label>Options</Label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <input key={i} className={inputClass} maxLength={80} placeholder={`Option ${i + 1}`} value={o} disabled={!!busy} onChange={(e) => setOptions((x) => x.map((v, j) => (j === i ? e.target.value : v)))} />
            ))}
            {options.length < 6 && (
              <button type="button" onClick={() => setOptions((x) => [...x, ""])} className="px-2 text-secondary font-bold text-brand">+ Add option</button>
            )}
          </div>
          <Label>Closes</Label>
          <div className="flex flex-wrap gap-2">
            {CLOSES.map(([label, h]) => (
              <Chip key={label} active={closes === h} onClick={() => setCloses(h)}>{label}</Chip>
            ))}
          </div>
          <div className="mt-4">
            <Group>
              <Toggle icon="checkCircle" label="Allow multiple answers" value={multiple} onChange={setMultiple} />
            </Group>
          </div>
        </>
      )}

      {err && <p role="alert" className="mt-4 px-1 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={!ready || !!busy} onClick={() => void submit()} className={buttonClass("primary", "mt-6 h-12 w-full")}>
        {busy ?? (mode === "announcement" ? "Publish announcement" : "Share")}
      </button>
    </Sheet>
  );
}
