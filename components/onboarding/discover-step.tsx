"use client";

import { useEffect, useRef, useState } from "react";
import { messageOf } from "@/components/community/kit";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi } from "@/lib/api/communities";
import { onboardingApi, type Suggestion } from "@/lib/api/onboarding";
import { GHOST } from "./frame";

type Load = { s: "loading" } | { s: "error"; msg: string } | { s: "ready"; desks: Suggestion[]; communities: Suggestion[] };
type Join = "joining" | "joined" | "requested" | { error: string };

function Card({ c, state, onJoin }: { c: Suggestion; state: Join | undefined; onJoin: () => void }) {
  const desk = c.kind === "course_desk";
  const title = desk ? [c.course_code, c.course_title].filter(Boolean).join(" · ") || c.name : c.name;
  const meta = [c.reason, c.members_count > 0 ? `${c.members_count} ${c.members_count === 1 ? "member" : "members"}` : null].filter(Boolean).join(" · ");
  const done = state === "joined" || state === "requested";
  return (
    <li className="rounded-2xl bg-surface-subtle p-3.5">
      <div className="flex items-center gap-3">
        <Avatar url={c.avatar} name={c.name} size={46} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-fg">{title}</span>
          <span className="block truncate text-supporting text-muted">{meta}</span>
        </span>
        <button
          type="button"
          disabled={done || state === "joining"}
          onClick={onJoin}
          className={`h-9 shrink-0 rounded-full px-4 text-secondary font-extrabold transition-[background-color,transform] active:scale-95 disabled:active:scale-100 ${done ? "bg-surface-interactive text-muted" : "bg-brand text-brand-fg hover:bg-brand-hover"}`}
        >
          {state === "joined" ? "Joined" : state === "requested" ? "Requested" : state === "joining" ? "…" : c.join_policy === "request" ? "Request" : "Join"}
        </button>
      </div>
      {c.description && <p className="mt-2.5 line-clamp-2 text-secondary leading-[1.4] text-muted">{c.description}</p>}
      {typeof state === "object" && <p role="alert" className="mt-2 text-supporting text-danger">{state.error}</p>}
    </li>
  );
}

// Only real, matched spaces. No padding, no invented counts. Nothing matched is an honest state with a next step.
export function DiscoverStep({ onShown, onFirstJoin, onFinish }: {
  onShown: () => void;
  onFirstJoin: (kind: "desk" | "community") => void;
  onFinish: (dest: string | null) => void;
}) {
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const [joins, setJoins] = useState<Record<number, Join>>({});
  const first = useRef<{ slug: string; name: string } | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    let alive = true;
    onboardingApi
      .picks()
      .then((r) => {
        if (!alive) return;
        setLoad({ s: "ready", desks: r.desks, communities: r.communities });
        if (!shown.current) {
          shown.current = true;
          onShown();
        }
      })
      .catch((e: unknown) => alive && setLoad({ s: "error", msg: messageOf(e) }));
    return () => {
      alive = false;
    };
  }, [onShown]);

  async function join(c: Suggestion) {
    setJoins((j) => ({ ...j, [c.id]: "joining" }));
    try {
      const r = await communitiesApi.join(c.id);
      const st = r.status ?? r.state;
      const joined = st === "joined" || st === "already_member";
      setJoins((j) => ({ ...j, [c.id]: joined ? "joined" : "requested" }));
      if (!first.current) {
        onFirstJoin(c.kind === "course_desk" ? "desk" : "community");
      }
      if (joined && !first.current) first.current = { slug: c.slug, name: c.kind === "course_desk" ? (c.course_code ?? c.name) : c.name };
    } catch (e) {
      setJoins((j) => ({ ...j, [c.id]: { error: messageOf(e) } }));
    }
  }

  const anyJoined = Object.values(joins).some((v) => v === "joined");
  const sections: [string, Suggestion[]][] = load.s === "ready"
    ? [["Course Desks", load.desks], ["Communities", load.communities]]
    : [];
  const empty = load.s === "ready" && load.desks.length === 0 && load.communities.length === 0;

  return (
    <>
      <div className="flex-1">
        {load.s === "loading" && (
          <div role="status" aria-busy="true" aria-label="Finding spaces for you" className="space-y-3">
            {[0, 1, 2].map((i) => <Sk key={i} className="h-[72px] w-full rounded-2xl" />)}
          </div>
        )}
        {load.s === "error" && <p role="alert" className="py-8 text-center text-body text-muted">{load.msg}</p>}
        {empty && (
          <div className="py-10 text-center">
            <p className="text-[17px] font-bold text-fg">Your campus is taking shape</p>
            <p className="mx-auto mt-2 max-w-[300px] text-body leading-snug text-muted">Nothing matches your department and level yet. Browse what&apos;s open, or start a space for your class.</p>
          </div>
        )}
        {sections.map(([label, items]) => items.length > 0 && (
          <section key={label} className="mb-6">
            <h2 className="mb-2.5 px-1 text-micro font-semibold uppercase tracking-[0.08em] text-muted">{label}</h2>
            <ul className="space-y-2.5">
              {items.map((c) => <Card key={c.id} c={c} state={joins[c.id]} onJoin={() => void join(c)} />)}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        {anyJoined && first.current ? (
          <>
            <Button onClick={() => onFinish(`/c/${first.current!.slug}`)} className="h-14 w-full">Open {first.current.name}</Button>
            <button type="button" onClick={() => onFinish(null)} className={GHOST}>Go to my feed</button>
          </>
        ) : (
          <>
            <Button onClick={() => onFinish(empty ? "/communities" : null)} className="h-14 w-full">
              {empty ? "Browse communities" : Object.keys(joins).length ? "Continue" : "Skip for now"}
            </Button>
            {empty && <button type="button" onClick={() => onFinish(null)} className={GHOST}>Go to my feed</button>}
          </>
        )}
      </div>
    </>
  );
}
