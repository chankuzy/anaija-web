"use client";

import { openAuth } from "@/lib/auth/auth-modal";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/settings/image-cropper";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { communitiesApi, type Policy } from "@/lib/api/communities";
import { uploadBlob } from "@/lib/api/upload";
import { useAuth } from "@/lib/auth/auth-context";
import { prepareImage } from "@/lib/create/image-pipeline";
import { useObjectUrl } from "@/lib/create/use-object-url";
import { AREA, CATEGORIES, Chip, ChoiceList, Label, messageOf } from "./kit";

const ACADEMIC = ["class", "department", "faculty"];

export function CreateCommunity() {
  const router = useRouter();
  const { status, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("class");
  const [course, setCourse] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [session, setSession] = useState("");
  const [campus, setCampus] = useState(true);
  const [join, setJoin] = useState<Policy>("open");
  const [listed, setListed] = useState<"listed" | "unlisted">("listed");
  const [read, setRead] = useState<"public_preview" | "members_only">("public_preview");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverPick, setCoverPick] = useState<File | null>(null);
  const [coverBlob, setCoverBlob] = useState<File | null>(null);
  const preview = useObjectUrl(file);
  const coverPreview = useObjectUrl(coverBlob);

  useEffect(() => {
    if (status === "guest") openAuth();
  }, [status, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || name.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      let avatar_key: string | undefined;
      if (file) {
        const p = await prepareImage(file);
        avatar_key = await uploadBlob(p.feed, `avatar.${p.ext}`, p.contentType);
      }
      let cover_key: string | undefined;
      if (coverBlob) cover_key = await uploadBlob(coverBlob, "cover.jpg", "image/jpeg");
      const c = await communitiesApi.create({
        name: name.trim(), description: description.trim() || undefined, category,
        ...(ACADEMIC.includes(category) ? { course_code: course.trim(), department: department.trim(), level: level.trim(), academic_session: session.trim() } : {}),
        ...(campus && user?.institution_id ? { institution_id: user.institution_id } : {}),
        join_policy: join, discoverability: listed, read_policy: read,
        ...(avatar_key ? { avatar_key } : {}),
      });
      if (cover_key) {
        try {
          await communitiesApi.update(c.id, { cover_key });
        } catch (e2) {
          setError(`Your community was created, but the cover didn't save: ${messageOf(e2)}`);
          setCreatedSlug(c.slug);
          setBusy(false);
          return;
        }
      }
      router.replace(`/c/${c.slug}`);
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  if (status !== "authed") return <div className="min-h-dvh" />;
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-3 md:pt-8">
      <h1 className="py-2 text-[26px] font-extrabold tracking-tight text-fg">New community</h1>
      <p className="px-1 text-secondary text-muted">A permanent space for a class, department, campus or interest. You can change everything below later.</p>

      <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { setCoverPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      <button
        type="button"
        onClick={() => coverRef.current?.click()}
        className="relative mt-5 flex h-[130px] w-full items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-surface-interactive to-surface-subtle text-secondary font-bold text-fg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverPreview && <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />}
        <span className="relative rounded-full bg-black/55 px-4 py-2 backdrop-blur-md">{coverBlob ? "Change cover" : "Add cover photo"}</span>
      </button>
      {coverBlob && (
        <button type="button" onClick={() => setCoverBlob(null)} className="mt-2 px-1 text-supporting font-bold text-danger">Remove cover</button>
      )}
      {coverPick && (
        <ImageCropper
          file={coverPick}
          spec={{ aspect: 8 / 3, circle: false, title: "Community cover", outW: 1200, viewW: 640 }}
          onCancel={() => setCoverPick(null)}
          onDone={(b) => { setCoverBlob(new File([b], "cover.jpg", { type: "image/jpeg" })); setCoverPick(null); }}
        />
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      <div className="mt-4 flex items-center gap-4">
        <Avatar url={preview} name={name || "?"} size={72} />
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-surface-interactive px-4 py-2.5 text-secondary font-bold text-fg">
          {file ? "Change picture" : "Add picture"}
        </button>
      </div>

      <Label>Name</Label>
      <input className={inputClass} placeholder="e.g. CSC 301 · 2026 Class" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />

      <Label hint="Optional">Description</Label>
      <textarea className={AREA} placeholder="What is this space for?" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />

      <Label>Type</Label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(([id, label]) => (
          <Chip key={id} active={category === id} onClick={() => setCategory(id)}>{label}</Chip>
        ))}
      </div>

      {ACADEMIC.includes(category) && (
        <>
          <Label hint="Optional">Academic details</Label>
          <div className="grid grid-cols-2 gap-2.5">
            <input className={inputClass} placeholder="Course code" value={course} onChange={(e) => setCourse(e.target.value)} />
            <input className={inputClass} placeholder="Level (e.g. 300)" value={level} onChange={(e) => setLevel(e.target.value)} />
            <input className={inputClass} placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
            <input className={inputClass} placeholder="Session (2025/2026)" value={session} onChange={(e) => setSession(e.target.value)} />
          </div>
        </>
      )}

      {user?.institution_id ? (
        <>
          <Label>Campus</Label>
          <div className="flex gap-2">
            <Chip active={campus} onClick={() => setCampus(true)}>Link to my campus</Chip>
            <Chip active={!campus} onClick={() => setCampus(false)}>No campus</Chip>
          </div>
        </>
      ) : null}

      <Label>Who can join</Label>
      <ChoiceList<Policy>
        value={join}
        onChange={setJoin}
        options={[
          { id: "open", title: "Anyone", desc: "People join instantly from the link or search." },
          { id: "request", title: "With approval", desc: "You or a moderator approve each request." },
          { id: "invite", title: "Invite only", desc: "Only people with an invitation link can join." },
        ]}
      />
      <Label>Discoverability</Label>
      <ChoiceList
        value={listed}
        onChange={setListed}
        options={[
          { id: "listed", title: "Searchable", desc: "Appears in Communities search." },
          { id: "unlisted", title: "Unlisted", desc: "Only people with the link can find it." },
        ]}
      />
      <Label>Who can read</Label>
      <ChoiceList
        value={read}
        onChange={setRead}
        options={[
          { id: "public_preview", title: "Public preview", desc: "Non-members can read the feed. Chat and Library stay members-only." },
          { id: "members_only", title: "Members only", desc: "Nothing is visible until someone joins." },
        ]}
      />

      {error && <p role="alert" className="mt-5 px-1 text-secondary text-danger">{error}</p>}
      {createdSlug && <Link href={`/c/${createdSlug}`} className="mt-2 inline-block px-1 text-secondary font-bold text-brand">Open your community</Link>}
      <button type="submit" disabled={busy || name.trim().length < 3} className={buttonClass("primary", "mt-7 h-14 w-full")}>
        {busy ? "Creating…" : "Create community"}
      </button>
    </form>
  );
}
