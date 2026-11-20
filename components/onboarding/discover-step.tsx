"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { messageOf } from "@/components/community/kit";
import { useMessages } from "@/components/messaging/messages-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi } from "@/lib/api/communities";
import { onboardingApi, type Person, type Picks, type Suggestion } from "@/lib/api/onboarding";
import { toggleFollow } from "@/lib/feed/follow-store";
import { GHOST } from "./frame";

type Load = { s: "loading" } | { s: "error"; msg: string } | { s: "ready"; picks: Picks };
type Join = "joining" | "joined" | "requested" | { error: string };
type Follow = "busy" | "on" | { error: string };
type Src = "platform" | "campus";
// The accent split: joining a space is yellow, following a person is white. Finished actions go quiet.
type Tone = "yellow" | "white";

function Pill({ label, tone, state, done, disabled, onClick }: { label: string; tone: Tone; state: "idle" | "busy" | "done"; done?: boolean; disabled?: boolean; onClick: () => void }) {
  const look =
    state !== "idle"
      ? "bg-surface-interactive text-fg"
      : tone === "yellow"
        ? "bg-brand text-brand-fg hover:bg-brand-hover"
        : "bg-fg text-bg hover:bg-white";
  return (
    <button
      type="button"
      disabled={disabled || state === "busy"}
      aria-pressed={done === undefined ? undefined : done}
      onClick={onClick}
      className={`inline-flex h-9 min-w-[92px] shrink-0 items-center justify-center gap-1 rounded-full px-4 text-secondary font-extrabold transition-[background-color,transform] active:scale-95 disabled:active:scale-100 ${look}`}
    >
      {state === "done" && <Icon name="check" weight="strong" className="size-3.5" />}
      {state === "busy" ? "…" : label}
    </button>
  );
}

function Head({ title, action }: { title: string; action?: { label: string; onClick: () => void } | null }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className="text-secondary font-bold text-fg underline-offset-4 hover:underline">
          {action.label}
        </button>
      )}
    </div>
  );
}

function Row({ avatar, name, title, seal, meta, desc, error, action }: {
  avatar: string | null; name: string | null; title: string; seal?: boolean; meta: string; desc?: string | null; error?: string | null; action: ReactNode;
}) {
  return (
    <li className="rounded-2xl bg-card p-3.5">
      <div className="flex items-center gap-3">
        <Avatar url={avatar} name={name} size={46} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[15px] font-bold text-fg">{title}</span>
            {seal && <Icon name="verifiedCheck" filled className="size-4 shrink-0 text-brand-ink" />}
          </span>
          <span className="block truncate text-supporting text-muted">{meta}</span>
        </span>
        {action}
      </div>
      {desc && <p className="mt-2.5 line-clamp-2 text-secondary leading-[1.4] text-muted">{desc}</p>}
      {error && <p role="alert" className="mt-2 text-supporting text-danger">{error}</p>}
    </li>
  );
}

// Tiers, each hidden when empty: Anaija's own spaces and accounts, matched campus spaces, popular public communities
// that top up a thin campus list, and people to follow. Labels only ever claim what the server proved.
export function DiscoverStep({ onShown, onFirstAction, onFinish }: {
  onShown: () => void;
  onFirstAction: (action: string) => void;
  onFinish: (dest: string | null) => void;
}) {
  const { reloadInbox } = useMessages();
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const [joins, setJoins] = useState<Record<number, Join>>({});
  const [follows, setFollows] = useState<Record<number, Follow | undefined>>({});
  const [first, setFirst] = useState<{ slug: string; name: string } | null>(null);
  const shown = useRef(false);
  const fired = useRef(false);

  useEffect(() => {
    let alive = true;
    onboardingApi
      .picks()
      .then((picks) => {
        if (!alive) return;
        setLoad({ s: "ready", picks });
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

  function noteAction(action: string) {
    if (fired.current) return;
    fired.current = true;
    onFirstAction(action);
  }

  async function join(c: Suggestion, src: Src) {
    setJoins((j) => ({ ...j, [c.id]: "joining" }));
    try {
      const r = await communitiesApi.join(c.id);
      const st = r.status ?? r.state;
      const joined = st === "joined" || st === "already_member";
      setJoins((j) => ({ ...j, [c.id]: joined ? "joined" : "requested" }));
      noteAction(src === "platform" ? "join_platform" : c.kind === "course_desk" ? "join_desk" : "join_community");
      if (joined && src === "campus") setFirst((f) => f ?? { slug: c.slug, name: c.kind === "course_desk" ? (c.course_code ?? c.name) : c.name });
    } catch (e) {
      setJoins((j) => ({ ...j, [c.id]: { error: messageOf(e) } }));
    }
  }

  async function follow(p: Person, official: boolean) {
    const cur = follows[p.id];
    if (cur === "busy") return;
    const wasOn = cur === "on";
    setFollows((f) => ({ ...f, [p.id]: "busy" }));
    const r = await toggleFollow(p.id, wasOn);
    if (r === null) return setFollows((f) => ({ ...f, [p.id]: { error: "Couldn't update that. Try again." } }));
    setFollows((f) => ({ ...f, [p.id]: r ? "on" : undefined }));
    if (r) noteAction(official ? "follow_account" : "follow_person");
  }

  const ready = load.s === "ready" ? load.picks : null;
  const campus = ready ? [...ready.desks, ...ready.communities] : [];
  const total = ready ? ready.platform.length + ready.accounts.length + campus.length + ready.popular.length + ready.people.length : 0;
  const empty = !!ready && total === 0;

  // "Join all" only ever covers open-join spaces: a request is something the person should choose to send.
  const joinable = (list: Suggestion[]) => list.filter((c) => c.join_policy === "open" && (joins[c.id] === undefined || typeof joins[c.id] === "object"));
  const allAction = (list: Suggestion[], src: Src) => {
    const todo = joinable(list);
    return todo.length >= 2 ? { label: "Join all", onClick: () => void Promise.all(todo.map((c) => join(c, src))) } : null;
  };

  const acted = Object.values(joins).some((v) => v === "joined" || v === "requested") || Object.values(follows).some((v) => v === "on");

  function finish(dest: string | null) {
    if (acted) reloadInbox();
    onFinish(dest);
  }

  function SpaceRow({ c, src }: { c: Suggestion; src: Src }) {
    const st = joins[c.id];
    const desk = c.kind === "course_desk";
    const title = desk ? [c.course_code, c.course_title].filter(Boolean).join(" · ") || c.name : c.name;
    const meta = [c.reason, c.members_count > 0 ? `${c.members_count} ${c.members_count === 1 ? "member" : "members"}` : null].filter(Boolean).join(" · ");
    const done = st === "joined" || st === "requested";
    return (
      <Row
        avatar={c.avatar}
        name={c.name}
        title={title}
        seal={src === "platform"}
        meta={meta}
        desc={c.description}
        error={typeof st === "object" ? st.error : null}
        action={
          <Pill
            tone="yellow"
            label={st === "joined" ? "Joined" : st === "requested" ? "Requested" : c.join_policy === "request" ? "Request" : "Join"}
            state={st === "joining" ? "busy" : done ? "done" : "idle"}
            disabled={done}
            onClick={() => void join(c, src)}
          />
        }
      />
    );
  }

  function PersonRow({ p, official }: { p: Person; official: boolean }) {
    const st = follows[p.id];
    const on = st === "on";
    return (
      <Row
        avatar={p.avatar}
        name={p.name ?? p.username}
        title={p.name || p.username || ""}
        seal={p.is_verified}
        meta={[p.username ? `@${p.username}` : null, p.label].filter(Boolean).join(" · ")}
        error={typeof st === "object" ? st.error : null}
        action={<Pill tone="white" label={on ? "Following" : "Follow"} state={st === "busy" ? "busy" : on ? "done" : "idle"} done={on} onClick={() => void follow(p, official)} />}
      />
    );
  }

  return (
    <>
      <div className="flex-1">
        {load.s === "loading" && (
          <div role="status" aria-busy="true" aria-label="Finding spaces for you" className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-[72px] w-full rounded-2xl" />)}
          </div>
        )}
        {load.s === "error" && <p role="alert" className="py-8 text-center text-body text-muted">{load.msg}</p>}
        {empty && (
          <div className="py-10 text-center">
            <p className="text-[17px] font-bold text-fg">You&apos;re early</p>
            <p className="mx-auto mt-2 max-w-[300px] text-body leading-snug text-muted">There&apos;s nothing to suggest yet. Spaces and people will show up here as Anaija grows.</p>
          </div>
        )}

        {ready && (ready.platform.length > 0 || ready.accounts.length > 0) && (
          <section aria-label="From Anaija" className="mb-8">
            <Head title="From Anaija" action={allAction(ready.platform, "platform")} />
            <ul className="space-y-2.5">
              {ready.platform.map((c) => <SpaceRow key={c.id} c={c} src="platform" />)}
              {ready.accounts.map((p) => <PersonRow key={p.id} p={p} official />)}
            </ul>
          </section>
        )}

        {ready && campus.length > 0 && (
          <section aria-label="On your campus" className="mb-8">
            <Head title="On your campus" action={allAction(campus, "campus")} />
            <ul className="space-y-2.5">
              {campus.map((c) => <SpaceRow key={c.id} c={c} src="campus" />)}
            </ul>
          </section>
        )}

        {ready && ready.popular.length > 0 && (
          <section aria-label="Popular communities" className="mb-8">
            <Head title={campus.length > 0 ? "More communities" : "Popular communities"} action={allAction(ready.popular, "campus")} />
            <ul className="space-y-2.5">
              {ready.popular.map((c) => <SpaceRow key={c.id} c={c} src="campus" />)}
            </ul>
          </section>
        )}

        {ready && ready.people.length > 0 && (
          <section aria-label="People to follow" className="mb-8">
            <Head title="People to follow" />
            <ul className="space-y-2.5">
              {ready.people.map((p) => <PersonRow key={p.id} p={p} official={false} />)}
            </ul>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-1 pt-6" style={{ background: "linear-gradient(to top, var(--color-bg) 62%, transparent)", paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
        {empty ? (
          <>
            <Button onClick={() => finish("/communities")} className="h-14 w-full">Browse communities</Button>
            <button type="button" onClick={() => finish(null)} className={GHOST}>Go to my feed</button>
          </>
        ) : acted ? (
          <>
            <Button onClick={() => finish(first ? `/c/${first.slug}` : null)} className="h-14 w-full">{first ? `Open ${first.name}` : "Continue"}</Button>
            {first && <button type="button" onClick={() => finish(null)} className={GHOST}>Go to my feed</button>}
          </>
        ) : (
          <button type="button" onClick={() => finish(null)} className={GHOST}>Skip for now</button>
        )}
      </div>
    </>
  );
}
