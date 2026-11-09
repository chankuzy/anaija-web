"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { communitiesApi, type DeskAccess, type Semester } from "@/lib/api/communities";
import { openAuth } from "@/lib/auth/auth-modal";
import { useAuth } from "@/lib/auth/auth-context";
import { AREA, Chip, ChoiceList, Label, messageOf } from "./kit";

const CODE_RE = /^[A-Z]{2,6}[ -]?\d{2,4}[A-Z]?$/;
const SEMESTERS: [Semester, string][] = [["first", "First"], ["second", "Second"], ["summer", "Summer"]];

// Entry point shown above the community form on /communities/new.
export function DeskEntry() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-3 md:pt-8">
      <Link href="/communities/new/desk" className="flex items-center gap-3 rounded-2xl border border-line bg-surface-subtle px-4 py-3.5 transition-colors hover:bg-surface-interactive">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-interactive text-fg">
          <Icon name="notebookMinimalistic" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-fg">Starting a course space?</span>
          <span className="block text-supporting text-muted">Create a Course Desk for materials, announcements and questions.</span>
        </span>
        <Icon name="back" className="size-4 rotate-180 text-muted" />
      </Link>
    </div>
  );
}

export function CreateDesk() {
  const router = useRouter();
  const { status, user } = useAuth();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [semester, setSemester] = useState<Semester | null>(null);
  const [session, setSession] = useState("");
  const [department, setDepartment] = useState("");
  const [faculty, setFaculty] = useState("");
  const [level, setLevel] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<DeskAccess>("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; similar: number } | null>(null);

  useEffect(() => {
    if (status === "guest") openAuth();
  }, [status]);

  const codeOk = CODE_RE.test(code.trim().toUpperCase());
  const ready = codeOk && title.trim().length >= 3;
  const hasCampus = !!user?.institution_id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    try {
      const r = await communitiesApi.deskCreate({
        course_code: code.trim().toUpperCase(), course_title: title.trim(), access,
        semester: semester ?? undefined, academic_session: opt(session), department: opt(department), faculty: opt(faculty),
        level: opt(level), lecturer_name: opt(lecturer), description: opt(description),
      });
      if (r.similar > 0) {
        setDone({ slug: r.community.slug, similar: r.similar });
        setBusy(false);
      } else {
        router.replace(`/c/${r.community.slug}`);
      }
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  if (status !== "authed") return <div className="min-h-dvh" />;

  if (done) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-10 text-center">
        <p className="text-[22px] font-extrabold tracking-tight text-fg">Your Course Desk is ready</p>
        <p className="mx-auto mt-2 max-w-[400px] text-secondary leading-[1.5] text-muted">
          {done.similar === 1 ? "1 other desk" : `${done.similar} other desks`} already exist for this course. Share your link with your class so everyone
          lands in one place, and ask classmates which desk they already use.
        </p>
        <Link href={`/c/${done.slug}`} className={buttonClass("primary", "mt-7 h-12 w-full")}>Open my Course Desk</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-3 md:pt-8">
      <h1 className="py-2 text-[26px] font-extrabold tracking-tight text-fg">New Course Desk</h1>
      <p className="px-1 text-secondary text-muted">
        One space per course: materials, announcements and questions in one place. It starts as student-led; a lecturer can ask Anaija to verify it later.
      </p>

      <Label>Course code</Label>
      <input className={inputClass} placeholder="e.g. MTH 201" maxLength={20} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      {code.trim() && !codeOk && <p className="mt-1.5 px-1 text-supporting text-danger">Use letters then numbers, like MTH 201.</p>}

      <Label>Course title</Label>
      <input className={inputClass} placeholder="e.g. Linear Algebra II" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />

      <Label hint="Optional">Semester</Label>
      <div className="flex gap-2">
        {SEMESTERS.map(([id, label]) => <Chip key={id} active={semester === id} onClick={() => setSemester(semester === id ? null : id)}>{label}</Chip>)}
      </div>

      <Label hint="Optional">Details</Label>
      <div className="grid grid-cols-2 gap-2.5">
        <input className={inputClass} placeholder="Session (2025/2026)" maxLength={20} value={session} onChange={(e) => setSession(e.target.value)} />
        <input className={inputClass} placeholder="Level (e.g. 200)" maxLength={20} value={level} onChange={(e) => setLevel(e.target.value)} />
        <input className={inputClass} placeholder="Department" maxLength={60} value={department} onChange={(e) => setDepartment(e.target.value)} />
        <input className={inputClass} placeholder="Faculty" maxLength={60} value={faculty} onChange={(e) => setFaculty(e.target.value)} />
      </div>
      <input className={`${inputClass} mt-2.5`} placeholder="Lecturer's name" maxLength={80} value={lecturer} onChange={(e) => setLecturer(e.target.value)} />

      <Label hint="Optional">Description</Label>
      <textarea className={AREA} placeholder="What will this desk be used for?" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />

      <Label>Who can join</Label>
      <ChoiceList<DeskAccess>
        value={access}
        onChange={setAccess}
        options={[
          { id: "open", title: "Open", desc: "Anyone with the link joins instantly." },
          { id: "restricted", title: "Restricted", desc: "You or an assistant approve each request." },
          ...(hasCampus ? [{ id: "institutional" as const, title: "My campus only", desc: "Only students of your campus can join." }] : []),
        ]}
      />

      {error && <p role="alert" className="mt-5 px-1 text-secondary text-danger">{error}</p>}
      <button type="submit" disabled={busy || !ready} className={buttonClass("primary", "mt-7 h-14 w-full")}>
        {busy ? "Creating…" : "Create Course Desk"}
      </button>
    </form>
  );
}
