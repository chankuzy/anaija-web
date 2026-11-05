"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MomentsTab } from "@/components/moments/moments-tab";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CommunityDetail, type SessionCard } from "@/lib/api/communities";
import { timeAgo } from "@/lib/format";
import { Chip, Empty, StatusChip, useFetch } from "./kit";
import { SessionCreate } from "./session-create";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const when = (s: SessionCard) =>
  s.status === "scheduled" && s.starts_at
    ? `Starts ${new Date(s.starts_at).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" })}`
    : `Started ${timeAgo(s.created_at)}`;

// The signature surface: an ink-dark card with the yellow mask. Counts are the server's, never decorative.
function InkCard({ s }: { s: SessionCard }) {
  return (
    <Link href={`/s/${s.code}`} className="block rounded-[20px] border border-line bg-surface-subtle p-4 text-fg transition-transform active:scale-[0.99]">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-fg"><Icon name="eyeClosed" filled className="size-5" /></span>
        <StatusChip status={s.status} />
        <span className="ml-auto text-supporting text-muted">{when(s)}</span>
      </div>
      <p className="mt-3.5 line-clamp-2 text-[18px] font-extrabold leading-[1.2] tracking-tight">{s.title}</p>
      <p className="mt-2 text-supporting text-muted">
        Anonymous · {plural(s.posts_count, "post", "posts")} · {plural(s.participants_count, "participant", "participants")}
      </p>
    </Link>
  );
}

export function SessionsTab({ c, seg0, onJoin }: { c: CommunityDetail; seg0: "sessions" | "moments"; onJoin: () => void }) {
  const [seg, setSeg] = useState(seg0);
  const [create, setCreate] = useState(false);
  const q = useFetch(c.can.read ? `sessions:${c.id}` : null, () => communitiesApi.sessions(c.slug));
  const { reload } = q;
  useEffect(() => {
    const on = () => reload();
    window.addEventListener("community:sessions", on);
    return () => window.removeEventListener("community:sessions", on);
  }, [reload]);

  const list = q.data ?? [];
  const active = list.filter((s) => s.status !== "ended");
  const ended = list.filter((s) => s.status === "ended");
  const joinable = !c.is_member && c.join_policy !== "invite" && c.request_status !== "pending";

  return (
    <div>
      <div className="flex items-center gap-2">
        <Chip active={seg === "sessions"} onClick={() => setSeg("sessions")}>Sessions</Chip>
        <Chip active={seg === "moments"} onClick={() => setSeg("moments")}>Moments</Chip>
        {c.can.session && seg === "sessions" && (
          <button type="button" onClick={() => setCreate(true)} className={buttonClass("primary", "ml-auto h-9 px-4 text-secondary")}>
            <Icon name="plus" className="size-4" />Start
          </button>
        )}
      </div>

      {seg === "moments" ? (
        <div className="cm-dark mt-4 rounded-[22px] px-3 pb-4"><MomentsTab c={c} /></div>
      ) : (
        <div className="mt-4">
          <p className="px-1 text-secondary leading-[1.45] text-muted">
            Post without your name. Hosts and moderators can&apos;t see who wrote what, and Anaija keeps account-linked records so abuse can still be handled.
          </p>
          {!c.can.read ? (
            <Empty title="This community is members-only" body="Join to see its sessions." />
          ) : q.loading ? (
            <div role="status" aria-busy="true" aria-label="Loading sessions" className="mt-4 space-y-3">
              <Sk className="h-[118px] w-full rounded-[20px]" /><Sk className="h-[118px] w-full rounded-[20px]" />
            </div>
          ) : q.error && !q.data ? (
            <Empty title="Couldn't load sessions" body={q.error}><button type="button" onClick={q.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
          ) : list.length === 0 ? (
            <Empty title="No sessions yet" body={c.can.session ? "Start one and share the link in your class group." : "When a host starts an anonymous session, it will appear here."}>
              {c.can.session && <button type="button" onClick={() => setCreate(true)} className={buttonClass("primary", "h-10 px-5")}>Start a session</button>}
            </Empty>
          ) : (
            <>
              {active.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{active.map((s) => <InkCard key={s.id} s={s} />)}</div>}
              {ended.length > 0 && (
                <>
                  <p className="px-1 pb-2 pt-6 text-micro font-bold uppercase tracking-[0.1em] text-muted">Earlier</p>
                  <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-subtle">
                    {ended.map((s) => (
                      <Link key={s.id} href={`/s/${s.code}`} className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-surface-interactive">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-fg">{s.title}</span>
                          <span className="block text-supporting text-muted">{plural(s.posts_count, "post", "posts")} · {timeAgo(s.created_at)}</span>
                        </span>
                        <Icon name="chevronRight" className="size-4 text-muted" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {!c.is_member && joinable && (
            <p className="mt-5 text-center text-secondary text-muted">
              Only members can post. <button type="button" onClick={onJoin} className="font-bold text-fg underline">{c.join_policy === "request" ? "Request to join" : "Join"}</button>
            </p>
          )}
        </div>
      )}

      {create && <SessionCreate c={c} onClose={() => setCreate(false)} onCreated={() => window.dispatchEvent(new Event("community:sessions"))} />}
    </div>
  );
}
