"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Empty, ReportSheet, messageOf, useFetch } from "@/components/community/kit";
import { useToast } from "@/components/settings/settings-kit";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { momentsApi, type Moment } from "@/lib/api/moments";
import { useAuth } from "@/lib/auth/auth-context";
import { TYPE_META, tint } from "@/lib/moments/meta";
import { confirmDialog } from "@/lib/ui/dialog";
import { Confession } from "./confession";
import { DeptWar } from "./war";
import { HotSeat } from "./hot-seat";
import { ConnectionBar, Countdown, Gate, MomentShare, StatusPill, TypeIcon, useMomentLive } from "./kit";
import { ReportsSheet } from "./moderation";
import { OneQuestion } from "./one-question";
import { Verdict } from "./verdict";

function endLabel(m: Moment): string | null {
  if (m.type === "hot_seat") return m.status === "active" ? "Close questions" : m.status === "closed" ? "End Hot Seat" : null;
  if (m.type === "confession_drop") return m.status === "active" ? "Close submissions" : m.status === "closed" ? "End drop" : null;
  return m.status === "active" ? "End now" : null;
}

export function MomentView({ code }: { code: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const { toast, show } = useToast();
  const q = useFetch(status === "loading" ? null : `m:${code}:${status}`, () => momentsApi.show(code), { persist: false });
  const m = q.data;
  const live = useMomentLive(m?.realtime_key ?? null, q.reload);
  const [share, setShare] = useState(false);
  const [reports, setReports] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!m) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 pt-3 md:pt-8">
        {q.error ? (
          <Empty title="Moment not found" body={q.error}><Link href="/communities" className={buttonClass("primary", "h-10 px-5")}>Browse communities</Link></Empty>
        ) : (
          <div role="status" aria-busy="true" aria-label="Loading Moment" className="space-y-4"><Sk className="h-40 w-full rounded-[26px]" /><Sk className="h-24 w-full rounded-[22px]" /><Sk className="h-24 w-full rounded-[22px]" /></div>
        )}
      </div>
    );
  }

  const v = m.viewer;
  const meta = TYPE_META[m.type];
  const props = { m, code, version: live.version, reload: q.reload, patch: q.patch, show };
  const label = endLabel(m);

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await fn();
      q.reload();
      if (done) show(done);
    } catch (e) {
      show(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function end() {
    if (!label || !(await confirmDialog({ title: `${label}?`, message: "This can't be undone.", confirmLabel: label }))) return;
    await act(() => momentsApi.end(code));
  }
  async function cancel() {
    if (!(await confirmDialog({ title: "Cancel this Moment?", message: "It closes for everyone and can't be reopened.", confirmLabel: "Cancel Moment", danger: true }))) return;
    await act(() => momentsApi.cancel(code));
  }
  async function remind() {
    if (!v.authenticated) return router.push(`/login?next=${encodeURIComponent(`/m/${code}`)}`);
    q.patch((d) => ({ ...d, viewer: { ...d.viewer, reminder: !d.viewer.reminder } }));
    try {
      await momentsApi.remind(code);
    } catch (e) {
      show(messageOf(e));
      q.reload();
    }
  }

  const remindable = v.is_member && (m.status === "scheduled" || (m.type === "confession_drop" && (m.status === "active" || m.status === "closed")));
  const countdown = m.status === "scheduled" && m.starts_at ? { to: m.starts_at, label: "Starts in" }
    : m.status === "active" && m.ends_at && m.type !== "confession_drop" ? { to: m.ends_at, label: "Ends in" } : null;

  let body: React.ReactNode;
  if (!v.can_view) body = <div className="mt-4 space-y-3"><Gate m={m} onJoined={q.reload} /><Empty title="Join to see this Moment" body="This community keeps its Moments for members." /></div>;
  else if (m.status === "cancelled") body = <Empty title="This Moment was cancelled" body={m.cancel_reason ?? undefined} />;
  else if (m.type === "hot_seat") body = <HotSeat {...props} />;
  else if (m.type === "verdict") body = <Verdict {...props} />;
  else if (m.type === "one_question") body = <OneQuestion {...props} />;
  else if (m.type === "confession_drop") body = <Confession {...props} />;
  else body = <DeptWar {...props} />;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-3 md:pt-8">
      <ConnectionBar joined={live.joined} online={live.online} />
      <div className="mo-in rounded-[28px] p-5" style={{ background: tint(meta.color, 11) }}>
        <div className="flex items-center gap-2.5">
          <Link href={`/c/${m.community.slug}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar url={m.community.avatar} name={m.community.name} size={28} />
            <span className="truncate text-secondary font-bold text-muted hover:text-fg">{m.community.name}</span>
          </Link>
          <span className="ml-auto"><StatusPill type={m.type} status={m.status} /></span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <TypeIcon type={m.type} />
          <div className="min-w-0">
            <p className="text-micro font-extrabold uppercase tracking-[0.1em]" style={{ color: meta.color }}>{meta.title}{m.is_official ? " · Official" : ""}</p>
            <p className="text-supporting text-muted">{meta.tag}</p>
          </div>
        </div>
        {v.can_view && <h1 className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-tight text-fg">{m.title}</h1>}
        {v.can_view && m.body && <p className="mt-2 whitespace-pre-wrap text-body leading-[1.5] text-fg/85">{m.body}</p>}
        {v.can_view && m.type !== "dept_war" && (
          <div className="mt-3 flex items-center gap-2 text-secondary text-muted">
            {m.host ? <><Avatar url={m.host.avatar} name={m.host.name} size={22} /><span className="font-semibold text-fg">{m.host.name}</span></> : <><Icon name="eyeClosed" className="size-[18px]" /><span>Hosted anonymously</span></>}
          </div>
        )}
        {v.can_view && <p className="mt-3 text-supporting text-muted">{m.participants_count} taking part{m.type !== "verdict" && m.type !== "dept_war" ? ` · ${m.entries_count} ${m.entries_count === 1 ? "entry" : "entries"}` : ""}</p>}
        {countdown && v.can_view && <div className="mt-4"><Countdown {...countdown} onDone={q.reload} /></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {v.can_view && m.status !== "cancelled" && <button type="button" onClick={() => setShare(true)} className={buttonClass("outline", "h-10 px-4")}><Icon name="share" className="size-4" />Share</button>}
          {remindable && <button type="button" onClick={() => void remind()} className={buttonClass("outline", "h-10 px-4")}><Icon name="bell" filled={v.reminder} className="size-4" />{v.reminder ? "Reminder on" : "Remind me"}</button>}
          {v.can_moderate && label && <button type="button" disabled={busy} onClick={() => void end()} className={buttonClass("outline", "h-10 px-4")}>{label}</button>}
          {v.can_moderate && !["completed", "cancelled"].includes(m.status) && <button type="button" disabled={busy} onClick={() => void cancel()} className={buttonClass("outline", "h-10 px-4 text-danger")}>Cancel</button>}
          {v.can_moderate && m.type !== "dept_war" && <button type="button" onClick={() => setReports(true)} className={buttonClass("outline", "h-10 px-4")}>Reports</button>}
          {v.is_member && !v.is_host && v.can_view && m.type !== "dept_war" && <button type="button" onClick={() => setReport(true)} className={buttonClass("ghost", "h-10 px-3 text-muted")}>Report</button>}
        </div>
        {m.anonymous && v.can_view && m.type !== "dept_war" && <p className="mt-3 text-supporting leading-[1.4] text-muted">The host&apos;s identity is hidden from everyone, including moderators.</p>}
      </div>

      {body}

      {share && <MomentShare m={m} onClose={() => setShare(false)} />}
      {reports && <ReportsSheet code={code} onClose={() => setReports(false)} onChanged={q.reload} />}
      {report && <ReportSheet title="Report this Moment" onClose={() => setReport(false)} onSubmit={(reason) => momentsApi.report(code, { reason }).then(() => { show("Report sent"); })} />}
      {toast}
    </div>
  );
}
