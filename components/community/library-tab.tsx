/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { PdfAttachment, isPdfUrl } from "@/components/home/renderers/document";
import { Group, Toggle, useToast } from "@/components/settings/settings-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail, type Resource } from "@/lib/api/communities";
import { uploadBlob } from "@/lib/api/upload";
import { DOC_ACCEPT, MAX_DOC_BYTES, docMimeOf } from "@/lib/create/structured";
import { formatBytes } from "@/lib/feed/structured";
import { timeAgo } from "@/lib/format";
import { confirmDialog } from "@/lib/ui/dialog";
import { AREA, Chip, Empty, Label, ReportSheet, Sheet, messageOf, useFetch } from "./kit";

const TYPE_LABEL: Record<string, string> = {
  past_question: "Past question", lecture_note: "Lecture note", slides: "Slides", textbook: "Textbook",
  assignment: "Assignment", syllabus: "Syllabus", project: "Project", other: "Other",
};
const TINT: Record<string, string> = {
  past_question: "from-amber-300 to-orange-500", lecture_note: "from-sky-300 to-indigo-500", slides: "from-fuchsia-300 to-purple-500",
  textbook: "from-emerald-300 to-teal-600", assignment: "from-rose-300 to-red-500", syllabus: "from-lime-300 to-green-600",
  project: "from-cyan-300 to-blue-500", other: "from-zinc-300 to-zinc-500",
};

function Cover({ r, large = false }: { r: Resource; large?: boolean }) {
  if (r.file?.thumbnail) return <img src={r.file.thumbnail} alt="" className="size-full object-cover" />;
  const code = r.course_code ?? (r.file?.mime?.includes("pdf") ? "PDF" : "DOC");
  return (
    <div className={`flex size-full flex-col justify-between bg-gradient-to-br ${TINT[r.doc_type] ?? TINT.other} ${large ? "p-5" : "p-3.5"} text-black/80`}>
      <span className="text-micro font-extrabold uppercase tracking-[0.1em]">{TYPE_LABEL[r.doc_type] ?? "Document"}</span>
      <span className={`${large ? "text-[40px]" : "text-[26px]"} font-black leading-none tracking-tight`}>{code}</span>
      <span className="text-supporting font-bold">{r.academic_session ?? r.subject ?? ""}</span>
    </div>
  );
}

function Detail({ c, r, onClose, onChanged }: { c: CommunityDetail; r: Resource; onClose: () => void; onChanged: () => void }) {
  const [report, setReport] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = r.file?.url ?? null;
  const pdf = !!url && (isPdfUrl(url) || r.file?.mime === "application/pdf");
  const canRemove = c.can.moderate;
  async function remove() {
    if (!(await confirmDialog({ title: "Remove from library?", confirmLabel: "Remove", danger: true }))) return;
    try {
      await communitiesApi.libraryRemove(c.id, r.id);
      onChanged();
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    }
  }
  return (
    <Sheet title={r.title} onClose={onClose} wide>
      <div className="flex gap-4">
        <div className="h-[150px] w-[112px] shrink-0 overflow-hidden rounded-[18px]"><Cover r={r} large /></div>
        <div className="min-w-0 flex-1">
          <p className="text-supporting font-bold uppercase tracking-wide text-muted">{TYPE_LABEL[r.doc_type] ?? "Document"}</p>
          <p className="mt-1 text-secondary text-muted">
            {[r.course_code, r.academic_session, r.subject].filter(Boolean).join(" · ") || "No course details"}
          </p>
          <p className="mt-1 text-supporting text-muted">
            {r.uploader ? `Shared by ${r.uploader.name ?? r.uploader.username}` : "Shared"} · {timeAgo(r.created_at)}
            {r.file?.size ? ` · ${formatBytes(r.file.size)}` : ""}
          </p>
        </div>
      </div>
      {r.description && <p className="mt-4 whitespace-pre-wrap px-1 text-body leading-[1.5] text-fg/90">{r.description}</p>}
      <div className="mt-4">
        {pdf && url ? (
          <PdfAttachment url={url} title={r.title} coverUrl={r.file?.thumbnail} />
        ) : url ? (
          <p className="rounded-2xl bg-surface-interactive p-4 text-secondary leading-[1.4] text-muted">In-app preview isn&apos;t available for this file type. You can download the original.</p>
        ) : (
          <p className="text-secondary text-muted">This file isn&apos;t available.</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {url && (
          <a href={url} target="_blank" rel="noreferrer noopener" download className={buttonClass("primary", "h-10 px-5")}>
            <Icon name="arrowDown" className="size-4" />
            Download
          </a>
        )}
        <button type="button" onClick={() => setReport(true)} className={buttonClass("outline", "h-10 px-5")}>Report</button>
        {canRemove && <button type="button" onClick={() => void remove()} className="h-10 rounded-full px-4 text-secondary font-bold text-danger">Remove</button>}
      </div>
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      {report && <ReportSheet title="Report resource" onClose={() => setReport(false)} onSubmit={(reason) => communitiesApi.report(c.id, { kind: "resource", target_id: r.id, reason }).then(() => {})} />}
    </Sheet>
  );
}

function Upload({ c, collections, onClose, onDone }: { c: CommunityDetail; collections: { id: number; name: string }[]; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("lecture_note");
  const [code, setCode] = useState("");
  const [session, setSession] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [collection, setCollection] = useState<number | null>(null);
  const [inFeed, setInFeed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!docMimeOf(f)) return setErr("Use a PDF, Word, PowerPoint, Excel or text file.");
    if (f.size > MAX_DOC_BYTES) return setErr("This file is larger than 25 MB.");
    setErr(null);
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }
  async function submit() {
    if (!file || !title.trim() || busy) return;
    const mime = docMimeOf(file);
    if (!mime) return;
    setErr(null);
    try {
      setBusy("Uploading…");
      const key = await uploadBlob(file, `document.${(file.name.split(".").pop() ?? "bin").toLowerCase()}`, mime);
      setBusy("Adding to library…");
      const post = await communitiesApi.post(c.id, {
        type: "post", subtype: "document", caption: title.trim(), client_request_id: requestId,
        media: [{ type: "document", storage_key: key, size_bytes: file.size, mime_type: mime }],
        content: { title: title.trim(), description: description.trim(), file: { name: file.name } },
      });
      await communitiesApi.libraryAdd(c.id, {
        post_id: post.post_id, title: title.trim(), doc_type: docType, course_code: code.trim() || undefined,
        academic_session: session.trim() || undefined, subject: subject.trim() || undefined,
        description: description.trim() || undefined, collection_id: collection, in_feed: inFeed,
      });
      onDone();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(null);
    }
  }
  return (
    <Sheet title="Add to library" onClose={onClose} wide>
      <input ref={fileRef} type="file" accept={DOC_ACCEPT} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="flex h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-[22px] bg-surface-interactive text-fg hover:bg-surface-elevated">
        <Icon name="copy" filled className="size-6" />
        <span className="max-w-[90%] truncate text-body font-bold">{file ? file.name : "Choose a file"}</span>
        <span className="text-supporting text-muted">{file ? formatBytes(file.size) : "PDF, Word, PowerPoint, Excel, text · up to 25 MB"}</span>
      </button>
      <Label>Title</Label>
      <input className={inputClass} maxLength={120} value={title} disabled={!!busy} onChange={(e) => setTitle(e.target.value)} />
      <Label>Type</Label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_LABEL).map(([id, l]) => <Chip key={id} active={docType === id} onClick={() => setDocType(id)}>{l}</Chip>)}
      </div>
      <Label hint="Optional">Details</Label>
      <div className="grid grid-cols-2 gap-2.5">
        <input className={inputClass} placeholder="Course code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
        <input className={inputClass} placeholder="Session (2025/2026)" maxLength={20} value={session} onChange={(e) => setSession(e.target.value)} />
      </div>
      <input className={`${inputClass} mt-2.5`} placeholder="Subject" maxLength={60} value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea className={`${AREA} mt-2.5 min-h-[80px]`} placeholder="Description" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      {collections.length > 0 && (
        <>
          <Label hint="Optional">Collection</Label>
          <div className="flex flex-wrap gap-2">
            <Chip active={collection === null} onClick={() => setCollection(null)}>None</Chip>
            {collections.map((x) => <Chip key={x.id} active={collection === x.id} onClick={() => setCollection(x.id)}>{x.name}</Chip>)}
          </div>
        </>
      )}
      <div className="mt-4">
        <Group><Toggle icon="feed" label="Also share in the community feed" value={inFeed} onChange={setInFeed} /></Group>
      </div>
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={!file || !title.trim() || !!busy} onClick={() => void submit()} className={buttonClass("primary", "mt-5 h-12 w-full")}>{busy ?? "Add to library"}</button>
    </Sheet>
  );
}

export function LibraryTab({ c, onJoin }: { c: CommunityDetail; onJoin: () => void }) {
  const { toast, show } = useToast();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [docType, setDocType] = useState<string | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [collection, setCollection] = useState<number | null>(null);
  const [open, setOpen] = useState<Resource | null>(null);
  const [upload, setUpload] = useState(false);
  const [newCol, setNewCol] = useState(false);
  const [colName, setColName] = useState("");
  const [extra, setExtra] = useState<{ key: string; items: Resource[]; cursor: string | null; more: boolean } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const key = c.is_member ? `lib:${c.id}:${dq}:${docType ?? ""}:${course ?? ""}:${collection ?? ""}` : null;
  const lib = useFetch(key, () => communitiesApi.library(c.id, { q: dq || undefined, doc_type: docType, course_code: course, collection_id: collection }));
  // Collections and facets arrive only on the unfiltered first page, so keep them from the first load.
  const meta = useFetch(c.is_member ? `libmeta:${c.id}` : null, () => communitiesApi.library(c.id, {}));
  const more = extra?.key === key ? extra : null;
  const items = [...(lib.data?.items ?? []), ...(more?.items ?? [])];
  const cursor = more ? more.cursor : (lib.data?.cursor ?? null);
  const hasMore = more ? more.more : (lib.data?.hasMore ?? false);

  async function loadMore() {
    if (!key || !cursor) return;
    try {
      const r = await communitiesApi.library(c.id, { cursor, q: dq || undefined, doc_type: docType, course_code: course, collection_id: collection });
      setExtra({ key, items: [...(more?.items ?? []), ...r.items], cursor: r.cursor, more: r.hasMore });
    } catch (e) {
      show(messageOf(e));
    }
  }
  const refresh = () => { lib.reload(); meta.reload(); };

  async function saveCollection() {
    if (!colName.trim()) return;
    try {
      await communitiesApi.collectionSave(c.id, { name: colName.trim() });
      setColName("");
      setNewCol(false);
      refresh();
    } catch (e) {
      show(messageOf(e));
    }
  }

  if (!c.is_member) {
    return (
      <Empty title="The library is for members" body="Past questions, notes and slides shared by the class.">
        {c.join_policy !== "invite" && c.request_status !== "pending" && (
          <button type="button" onClick={onJoin} className={buttonClass("primary", "h-10 px-5")}>{c.join_policy === "request" ? "Request to join" : "Join"}</button>
        )}
      </Empty>
    );
  }

  const collections = meta.data?.collections ?? [];
  const codes = meta.data?.facets?.course_codes ?? [];
  const filtered = !!(dq || docType || course || collection);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input className={`${inputClass} h-11 pl-11`} placeholder="Search title, course code or subject" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {c.can.library && (
          <button type="button" onClick={() => setUpload(true)} className={buttonClass("primary", "h-11 px-4")}>
            <Icon name="plus" className="size-5" />
            Add
          </button>
        )}
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        <Chip active={!docType} onClick={() => setDocType(null)}>All types</Chip>
        {Object.entries(TYPE_LABEL).map(([id, l]) => <Chip key={id} active={docType === id} onClick={() => setDocType(docType === id ? null : id)}>{l}</Chip>)}
      </div>
      {codes.length > 0 && (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {codes.map((x) => <Chip key={x} active={course === x} onClick={() => setCourse(course === x ? null : x)}>{x}</Chip>)}
        </div>
      )}
      {(collections.length > 0 || c.can.moderate) && (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {collections.map((x) => <Chip key={x.id} active={collection === x.id} onClick={() => setCollection(collection === x.id ? null : x.id)}>{x.name}{x.count ? ` · ${x.count}` : ""}</Chip>)}
          {c.can.moderate && <Chip onClick={() => setNewCol((v) => !v)}>+ Collection</Chip>}
        </div>
      )}
      {newCol && (
        <div className="mt-2 flex gap-2">
          <input className={`${inputClass} h-11`} placeholder="Collection name" maxLength={60} value={colName} onChange={(e) => setColName(e.target.value)} />
          <button type="button" onClick={() => void saveCollection()} className={buttonClass("primary", "h-11 px-5")}>Save</button>
        </div>
      )}

      <div className="mt-4">
        {lib.loading ? (
          <div role="status" aria-busy="true" aria-label="Loading library" className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <Sk key={i} className="aspect-[3/4] rounded-[20px]" />)}
          </div>
        ) : lib.error ? (
          <Empty title="Couldn't load the library" body={lib.error}><button type="button" onClick={lib.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
        ) : items.length === 0 ? (
          <Empty title={filtered ? "Nothing matches" : "The library is empty"} body={filtered ? "Try different filters." : c.can.library ? "Add the first past question, note or slide deck for your class." : "Resources shared by this community will appear here."}>
            {!filtered && c.can.library && <button type="button" onClick={() => setUpload(true)} className={buttonClass("primary", "h-10 px-5")}>Add a resource</button>}
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {items.map((r) => (
                <button key={r.id} type="button" onClick={() => setOpen(r)} className="group text-left">
                  <span className="block aspect-[3/4] overflow-hidden rounded-[20px] transition-transform group-active:scale-[0.98]"><Cover r={r} /></span>
                  <span className="mt-2 line-clamp-2 block px-1 text-[14px] font-bold leading-[1.25] text-fg">{r.title}</span>
                  <span className="mt-0.5 block truncate px-1 text-supporting text-muted">{[r.course_code, r.academic_session].filter(Boolean).join(" · ") || timeAgo(r.created_at)}</span>
                </button>
              ))}
            </div>
            {hasMore && <button type="button" onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto mt-5 h-10")}>Show more</button>}
          </>
        )}
      </div>

      {open && <Detail c={c} r={open} onClose={() => setOpen(null)} onChanged={refresh} />}
      {upload && <Upload c={c} collections={collections} onClose={() => setUpload(false)} onDone={() => { setUpload(false); refresh(); show("Added to library"); }} />}
      {toast}
    </div>
  );
}
