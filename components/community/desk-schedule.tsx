"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { Sk } from "@/components/ui/skeleton";
import {
  REMINDER_OPTIONS,
  communitiesApi,
  type CommunityDetail,
  type DeskEvent,
  type EventInput,
  type EventKind,
} from "@/lib/api/communities";
import { AREA, Chip, Empty, Label, Sheet, messageOf, useFetch } from "./kit";

// Event times are shown and typed in Nigerian time. Nigeria has no daylight saving (always UTC+1), so inputs are
// converted with a fixed offset; on the wire everything is UTC.
const LAGOS = "Africa/Lagos";
const OFFSET_MS = 3_600_000;
const MAX_REMINDERS = 3;

export const KIND_LABEL: Record<EventKind, string> = {
  lecture: "Lecture", extra_class: "Extra class", test: "Test", revision: "Revision", deadline: "Deadline", other: "Other",
};
const KINDS = Object.keys(KIND_LABEL) as EventKind[];
const REMINDER_LABEL: Record<number, string> = { 60: "1 hour before", 180: "3 hours before", 1440: "1 day before", 4320: "3 days before" };

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, hour: "numeric", minute: "2-digit", hour12: true });

export function whenLagos(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${dayFmt.format(d)}, ${timeFmt.format(d).toUpperCase()}`;
}
const toInput = (iso: string) => new Date(Date.parse(iso) + OFFSET_MS).toISOString().slice(0, 16);
function fromInput(v: string): string | null {
  if (!v) return null;
  const t = Date.parse(`${v}:00+01:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
const defaultStart = () => toInput(new Date(Math.ceil((Date.now() + 3_600_000) / 3_600_000) * 3_600_000).toISOString());

function range(e: DeskEvent): string {
  const start = whenLagos(e.starts_at);
  if (!e.ends_at) return start;
  const s = new Date(e.starts_at);
  const en = new Date(e.ends_at);
  const sameDay = dayFmt.format(s) === dayFmt.format(en);
  return `${start} – ${sameDay ? timeFmt.format(en).toUpperCase() : whenLagos(e.ends_at)}`;
}

const badge = "inline-flex items-center rounded-pill px-2.5 py-1 text-micro font-extrabold uppercase tracking-wide";

function EventRow({ e, canEdit, onEdit, onCancel }: { e: DeskEvent; canEdit: boolean; onEdit: () => void; onCancel: () => void }) {
  const cancelled = e.status === "cancelled";
  const moved = !cancelled && e.change_kind === "rescheduled" && !!e.previous_starts_at;
  const updated = !cancelled && e.change_kind === "updated";
  return (
    <div className="px-1 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${badge} bg-surface-interactive text-muted`}>{KIND_LABEL[e.kind]}</span>
        {cancelled && <span className={`${badge} bg-danger/15 text-danger`}>Cancelled</span>}
        {moved && <span className={`${badge} bg-brand/15 text-brand-ink`}>Rescheduled</span>}
        {updated && <span className={`${badge} bg-surface-interactive text-muted`}>Updated</span>}
      </div>
      <p className={`mt-1.5 text-[15px] font-semibold ${cancelled ? "text-muted line-through" : "text-fg"}`}>{e.title}</p>
      <p className="text-supporting text-muted">{range(e)}</p>
      {moved && <p className="text-supporting text-muted">Was {whenLagos(e.previous_starts_at)}</p>}
      {cancelled && e.cancel_reason && <p className="text-supporting text-muted">{e.cancel_reason}</p>}
      {e.venue && <p className="text-supporting text-muted">{e.venue}</p>}
      {e.description && <p className="mt-1 whitespace-pre-wrap text-secondary leading-[1.4] text-fg/80">{e.description}</p>}
      {((!cancelled && e.meeting_url) || (canEdit && !cancelled)) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!cancelled && e.meeting_url && (
            <a href={e.meeting_url} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "h-9 px-4 text-secondary")}>
              Join online
            </a>
          )}
          {canEdit && !cancelled && (
            <>
              <button type="button" onClick={onEdit} className="h-9 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-fg">Edit</button>
              <button type="button" onClick={onCancel} className="h-9 rounded-full px-4 text-secondary font-bold text-danger">Cancel event</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EventForm({ c, event, onDone, onBack }: { c: CommunityDetail; event: DeskEvent | null; onDone: () => void; onBack: () => void }) {
  const [kind, setKind] = useState<EventKind>(event?.kind ?? "lecture");
  const [title, setTitle] = useState(event?.title ?? "");
  const [startsAt, setStartsAt] = useState(() => (event ? toInput(event.starts_at) : defaultStart()));
  const [endsAt, setEndsAt] = useState(() => (event?.ends_at ? toInput(event.ends_at) : ""));
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [url, setUrl] = useState(event?.meeting_url ?? "");
  const [desc, setDesc] = useState(event?.description ?? "");
  const [reminders, setReminders] = useState<number[]>(() => [...(event?.remind_minutes ?? [])].sort((a, b) => a - b));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (m: number) =>
    setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : r.length >= MAX_REMINDERS ? r : [...r, m].sort((a, b) => a - b)));

  async function submit() {
    if (busy) return;
    const s = fromInput(startsAt);
    const en = endsAt ? fromInput(endsAt) : null;
    const link = url.trim();
    if (title.trim().length < 3) return setErr("Give the event a title (at least 3 characters).");
    if (!s) return setErr("Choose a start time.");
    if (endsAt && !en) return setErr("Choose a valid end time.");
    if (en && Date.parse(en) <= Date.parse(s)) return setErr("The end must be after the start.");
    if (link && !/^https?:\/\//i.test(link)) return setErr("Use a link that starts with https://");
    if ((!event || Date.parse(s) !== Date.parse(event.starts_at)) && Date.parse(s) < Date.now() - 4 * 60_000) {
      return setErr("Choose a time in the future.");
    }
    setErr(null);
    setBusy(true);
    try {
      if (!event) {
        await communitiesApi.deskEventCreate(c.id, {
          kind, title: title.trim(), starts_at: s, ends_at: en, venue: venue.trim() || null,
          meeting_url: link || null, description: desc.trim() || null, remind_minutes: reminders,
        });
      } else {
        // Only what changed goes up, so an unchanged time is never mistaken for a reschedule.
        const patch: Partial<EventInput> = {};
        if (kind !== event.kind) patch.kind = kind;
        if (title.trim() !== event.title) patch.title = title.trim();
        if (Date.parse(s) !== Date.parse(event.starts_at)) patch.starts_at = s;
        const oldEnd = event.ends_at ? Date.parse(event.ends_at) : null;
        if (oldEnd !== (en ? Date.parse(en) : null)) patch.ends_at = en;
        if ((venue.trim() || null) !== (event.venue ?? null)) patch.venue = venue.trim() || null;
        if ((link || null) !== (event.meeting_url ?? null)) patch.meeting_url = link || null;
        if ((desc.trim() || null) !== (event.description ?? null)) patch.description = desc.trim() || null;
        const oldRem = [...(event.remind_minutes ?? [])].sort((a, b) => a - b);
        if (JSON.stringify(reminders) !== JSON.stringify(oldRem)) patch.remind_minutes = reminders;
        if (Object.keys(patch).length === 0) return onBack();
        await communitiesApi.deskEventUpdate(c.id, event.id, { ...patch, expected_version: event.version });
      }
      onDone();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <Label>What is it</Label>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => <Chip key={k} active={kind === k} disabled={busy} onClick={() => setKind(k)}>{KIND_LABEL[k]}</Chip>)}
      </div>
      <Label>Title</Label>
      <input className={inputClass} maxLength={140} placeholder="e.g. Week 5 lecture" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
      <Label hint="Nigerian time">Starts</Label>
      <input type="datetime-local" className={inputClass} value={startsAt} disabled={busy} onChange={(e) => setStartsAt(e.target.value)} />
      <Label hint="Optional">Ends</Label>
      <input type="datetime-local" className={inputClass} value={endsAt} disabled={busy} onChange={(e) => setEndsAt(e.target.value)} />
      <Label hint="Optional">Venue</Label>
      <input className={inputClass} maxLength={120} placeholder="Hall or room" value={venue} disabled={busy} onChange={(e) => setVenue(e.target.value)} />
      <Label hint="Optional">Online meeting link</Label>
      <input className={inputClass} inputMode="url" maxLength={300} placeholder="https://" value={url} disabled={busy} onChange={(e) => setUrl(e.target.value)} />
      <Label hint="Optional">Details</Label>
      <textarea className={AREA} maxLength={1000} placeholder="Anything students should bring or prepare" value={desc} disabled={busy} onChange={(e) => setDesc(e.target.value)} />
      <Label hint={`Up to ${MAX_REMINDERS}`}>Remind students</Label>
      <div className="flex flex-wrap gap-2">
        {REMINDER_OPTIONS.map((m) => <Chip key={m} active={reminders.includes(m)} disabled={busy} onClick={() => toggle(m)}>{REMINDER_LABEL[m]}</Chip>)}
      </div>
      <p className="mt-3 px-1 text-supporting leading-[1.4] text-muted">
        Members with announcements on are told about a new event. Everyone is told if its time or place changes, or it is cancelled.
      </p>
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => void submit()} className={buttonClass("primary", "mt-5 h-12 w-full")}>
        {busy ? "Saving…" : event ? "Save changes" : "Add to schedule"}
      </button>
      <button type="button" disabled={busy} onClick={onBack} className="mt-2 h-11 w-full text-secondary font-semibold text-muted">Back</button>
    </div>
  );
}

function CancelForm({ c, event, onDone, onBack }: { c: CommunityDetail; event: DeskEvent; onDone: () => void; onBack: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await communitiesApi.deskEventCancel(c.id, event.id, reason.trim() || undefined);
      onDone();
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="px-1 text-[15px] font-semibold text-fg">{event.title}</p>
      <p className="px-1 text-supporting text-muted">{whenLagos(event.starts_at)}</p>
      <Label hint="Optional">Reason</Label>
      <textarea className={AREA} maxLength={200} placeholder="Shown to students, e.g. Lecturer is away" value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
      <p className="mt-2 px-1 text-supporting leading-[1.4] text-muted">Everyone in this Course Desk is told it is cancelled. This can&apos;t be undone: create a new event instead.</p>
      {err && <p role="alert" className="mt-3 text-secondary text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => void submit()} className="mt-5 h-12 w-full rounded-full bg-danger/90 text-[15px] font-bold text-white disabled:opacity-60">
        {busy ? "Cancelling…" : "Cancel event"}
      </button>
      <button type="button" disabled={busy} onClick={onBack} className="mt-2 h-11 w-full text-secondary font-semibold text-muted">Keep event</button>
    </div>
  );
}

type Mode = { t: "list" } | { t: "form"; event: DeskEvent | null } | { t: "cancel"; event: DeskEvent };

export function ScheduleSheet({ c, canEdit, onClose, onChanged }: { c: CommunityDetail; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<Mode>({ t: "list" });
  const [past, setPast] = useState(false);
  const [extra, setExtra] = useState<{ items: DeskEvent[]; more: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const up = useFetch(`events:${c.id}`, () => communitiesApi.deskEvents(c.id), { persist: false });
  const old = useFetch(past ? `events-past:${c.id}` : null, () => communitiesApi.deskPastEvents(c.id), { persist: false });
  const { reload: reloadUp } = up;
  const { reload: reloadOld } = old;

  const changed = () => {
    reloadUp();
    if (past) reloadOld();
    setExtra(null);
    onChanged();
    setMode({ t: "list" });
  };

  if (mode.t === "form") {
    return (
      <Sheet title={mode.event ? "Edit event" : "New event"} onClose={onClose} wide>
        <EventForm c={c} event={mode.event} onDone={changed} onBack={() => setMode({ t: "list" })} />
      </Sheet>
    );
  }
  if (mode.t === "cancel") {
    return (
      <Sheet title="Cancel event" onClose={onClose} wide>
        <CancelForm c={c} event={mode.event} onDone={changed} onBack={() => setMode({ t: "list" })} />
      </Sheet>
    );
  }

  const data = past ? old.data : up.data;
  const items = past ? [...(old.data?.data ?? []), ...(extra?.items ?? [])] : (up.data?.data ?? []);
  const hasMore = past ? (extra ? extra.more : (old.data?.has_more ?? false)) : false;
  const loading = past ? old.loading : up.loading;
  const error = past ? old.error : up.error;

  async function morePast() {
    const last = items[items.length - 1];
    if (!last) return;
    try {
      const r = await communitiesApi.deskPastEvents(c.id, last.starts_at);
      setExtra({ items: [...(extra?.items ?? []), ...r.data], more: r.has_more });
    } catch (e) {
      setErr(messageOf(e));
    }
  }

  return (
    <Sheet title="Schedule" onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!past} onClick={() => setPast(false)}>Upcoming</Chip>
        <Chip active={past} onClick={() => setPast(true)}>Past</Chip>
        <span className="flex-1" />
        {canEdit && <button type="button" onClick={() => setMode({ t: "form", event: null })} className={buttonClass("primary", "h-9 px-4 text-secondary")}>Add event</button>}
      </div>
      <p className="mt-2 px-1 text-supporting text-muted">All times are Nigerian time.</p>

      <div className="mt-2">
        {loading && !data ? (
          <div role="status" aria-busy="true" aria-label="Loading schedule" className="space-y-4 px-1 pt-3">
            {[0, 1, 2].map((i) => <Sk key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : error && !data ? (
          <Empty title="Couldn't load the schedule" body={error}>
            <button type="button" onClick={() => (past ? reloadOld() : reloadUp())} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
          </Empty>
        ) : items.length === 0 ? (
          <Empty title={past ? "No past events" : "Nothing scheduled"} body={!past && canEdit ? "Add the next lecture, test or deadline." : undefined} />
        ) : (
          <div className="divide-y divide-line">
            {items.map((e) => (
              <EventRow key={e.id} e={e} canEdit={canEdit && !past} onEdit={() => setMode({ t: "form", event: e })} onCancel={() => setMode({ t: "cancel", event: e })} />
            ))}
          </div>
        )}
        {past && hasMore && <button type="button" onClick={() => void morePast()} className={buttonClass("outline", "mx-auto mt-4 h-10")}>Show more</button>}
        {err && <p role="alert" className="mt-3 px-1 text-secondary text-danger">{err}</p>}
      </div>
    </Sheet>
  );
}
