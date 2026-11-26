"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";
import { VerifiedSeal } from "@/components/ui/verified-seal";
import { errMsg } from "@/lib/api/platform";
import { platformDesksApi, type PlatformDeskDetail } from "@/lib/api/platform-desks";
import { revalidate, useCached } from "@/lib/cache/swr";
import { confirmDialog } from "@/lib/ui/dialog";
import { Footnote, Group, SectionLabel, SettingsPage, Tile, useToast } from "@/components/settings/settings-kit";
import { DeskStatusPill } from "./desks-view";
import { useStaff } from "./staff-context";

const field = "w-full rounded-[18px] bg-surface-interactive px-4 text-[15px] text-fg outline-none placeholder:text-muted disabled:opacity-60";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—");

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="text-secondary text-muted">{k}</span>
      <span className="min-w-0 truncate text-right text-[15px] font-semibold text-fg">{v}</span>
    </div>
  );
}

export function DeskDetailView() {
  const { id } = useParams<{ id: string }>();
  const deskId = Number(id);
  const staff = useStaff();
  const canVerify = staff.can("desks.verify");
  const { toast, show } = useToast();
  const { data: c, error, refresh } = useCached<PlatformDeskDetail>(
    `admin:desk:${deskId}`, () => platformDesksApi.get(deskId), { staleMs: 15_000 },
  );
  const [uname, setUname] = useState<string | null>(null);
  const [lname, setLname] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(status: "verified" | "rejected" | "unverified") {
    if (!c || busy) return;
    const lecturerUsername = (uname ?? c.lecturer?.username ?? c.owner?.username ?? "").trim();
    const copy = {
      verified: { title: `Verify ${c.course_code}?`, message: `@${lecturerUsername || "?"} becomes the verified lecturer and gets full control of this desk.`, confirmLabel: "Verify" },
      rejected: { title: "Reject this request?", message: "The owner sees your note.", confirmLabel: "Reject" },
      unverified: { title: "Revoke verification?", message: "The lecturer loses the designation and the desk goes back to student-led.", confirmLabel: "Revoke" },
    }[status];
    if (!(await confirmDialog({ ...copy, danger: status !== "verified" }))) return;
    setBusy(true);
    try {
      await platformDesksApi.verify(c.id, {
        status, note: note.trim(),
        ...(status === "verified" ? { lecturer_username: lecturerUsername, lecturer_name: (lname ?? c.lecturer_name ?? "").trim() } : {}),
      });
      setNote("");
      setUname(null);
      setLname(null);
      await refresh();
      for (const s of ["pending", "verified", "rejected", "all"] as const) void revalidate(`admin:desks:${s}`, () => platformDesksApi.list(s));
      show(status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Verification revoked");
    } catch (e) {
      show(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  if (!c) {
    body = error ? (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-fg">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-fg px-5 text-secondary font-extrabold text-bg">Try again</button>
      </div>
    ) : (
      <SettingsGroupsSkeleton groups={3} rows={3} />
    );
  } else {
    const campus = c.institution ? (c.institution.short_name ?? c.institution.name) : null;
    body = (
      <>
        <div className="flex items-center gap-2.5 px-1 pb-2">
          <DeskStatusPill s={c.verification_status} />
          <span className="text-supporting text-muted">
            {c.verification_status === "pending" ? `Asked ${when(c.verification_requested_at)}` : c.verified_at ? `Verified ${when(c.verified_at)}` : `Created ${when(c.created_at)}`}
          </span>
        </div>

        <SectionLabel>Course</SectionLabel>
        <Group>
          <Row k="Course" v={`${c.course_code} · ${c.course_title}`} />
          <Row k="Campus" v={campus ?? "Not linked"} />
          <Row k="Department" v={c.department ?? "—"} />
          <Row k="Level" v={c.level ?? "—"} />
          <Row k="Session" v={c.academic_session ?? "—"} />
          <Row k="Members" v={c.members.toLocaleString()} />
          <Row k="Listed in Discover" v={c.listed ? "Yes" : "No"} />
        </Group>

        <div className="h-6" />
        <SectionLabel>The request</SectionLabel>
        <Group>
          <Row k="Desk owner" v={c.owner ? `${c.owner.name ?? ""} @${c.owner.username ?? ""}`.trim() : "—"} />
          <Row k="Lecturer named" v={c.lecturer_name ?? "—"} />
          {c.lecturer && (
            <Row k="Verified lecturer" v={<span className="inline-flex items-center gap-1.5"><VerifiedSeal size={16} decorative />{c.lecturer.name} @{c.lecturer.username}</span>} />
          )}
          {c.verification_note && (
            <div className="px-4 py-3">
              <p className="text-supporting text-muted">{c.verification_status === "pending" ? "Owner's evidence" : "Last note"}</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-[1.4] text-fg">{c.verification_note}</p>
            </div>
          )}
        </Group>

        {c.duplicate_desks.length > 0 && (
          <>
            <div className="h-6" />
            <SectionLabel>Possible duplicates</SectionLabel>
            <Group>
              {c.duplicate_desks.map((d) => (
                <Link key={d.id} href={`/admin/desks/${d.id}`} className="block px-4 py-3 transition-colors hover:bg-fg/5">
                  <p className="truncate text-[15px] font-semibold text-fg">{d.name}</p>
                  <p className="truncate text-secondary text-muted">{d.members} members{d.owner?.username ? ` · @${d.owner.username}` : ""} · {d.status}</p>
                </Link>
              ))}
            </Group>
            <Footnote>Same campus, course code and session. Verify one and point the other class to it.</Footnote>
          </>
        )}

        {canVerify && (
          <>
            <div className="h-6" />
            <SectionLabel>Decision</SectionLabel>
            <Group>
              <div className="space-y-3 p-4">
                <input aria-label="Lecturer's Anaija username" className={`${field} h-12`} placeholder="Lecturer's Anaija username"
                  value={uname ?? c.lecturer?.username ?? c.owner?.username ?? ""} disabled={busy} onChange={(e) => setUname(e.target.value)} />
                <input aria-label="Lecturer's full name" className={`${field} h-12`} placeholder="Lecturer's full name, as on the staff page" maxLength={80}
                  value={lname ?? c.lecturer_name ?? ""} disabled={busy} onChange={(e) => setLname(e.target.value)} />
                <textarea aria-label="How you confirmed" rows={4} maxLength={500} className={`${field} resize-none py-3 leading-[1.4]`}
                  placeholder="How you confirmed: staff page link, method (institutional email / department call) and date."
                  value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
              </div>
            </Group>
            <Footnote>
              The lecturer must already be a member of the desk: ask them to open its invite link first. The desk owner is used if the username is left as shown. Your note goes into the audit log.
            </Footnote>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" disabled={busy || note.trim().length < 10} onClick={() => void decide("verified")}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-extrabold text-brand-fg disabled:opacity-40">
                <VerifiedSeal size={20} decorative className="!text-brand-fg" />
                {c.verification_status === "verified" ? "Re-verify with these details" : "Verify lecturer"}
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={busy || note.trim().length < 5} onClick={() => void decide("rejected")}
                  className="h-11 flex-1 rounded-full bg-surface-interactive text-[15px] font-bold text-fg disabled:opacity-40">Reject</button>
                {c.verification_status === "verified" && (
                  <button type="button" disabled={busy || note.trim().length < 5} onClick={() => void decide("unverified")}
                    className="h-11 flex-1 rounded-full bg-danger/90 text-[15px] font-bold text-white disabled:opacity-40">Revoke</button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="h-6" />
        <Group>
          <Tile icon="usersGroupRounded" label="Open the Course Desk" href={`/c/${encodeURIComponent(c.slug)}`} />
        </Group>
      </>
    );
  }

  return (
    <SettingsPage title={c ? (c.course_code ?? "Course Desk") : "Course Desk"} backHref="/admin/desks">
      {body}
      {toast}
    </SettingsPage>
  );
}
