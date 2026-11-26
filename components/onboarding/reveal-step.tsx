"use client";

import { useEffect, useRef, useState } from "react";
import { messageOf } from "@/components/community/kit";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { opportunitiesApi, type MatchedPerson, type Opportunity, type OpportunityList, type PeopleMatches } from "@/lib/api/opportunities";
import { toggleFollow } from "@/lib/feed/follow-store";
import { DiscoverStep } from "./discover-step";

type Load<T> = { s: "loading" } | { s: "error"; msg: string } | { s: "ready"; v: T };
type Follow = "busy" | "on" | { error: string };

const H = "mb-2.5 px-1 text-micro font-semibold uppercase tracking-[0.08em] text-muted";
const PILL = "inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-4 text-secondary font-extrabold transition-[background-color,transform] active:scale-95";
const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function PersonRow({ p, onGone, onFirst }: { p: MatchedPerson; onGone: () => void; onFirst: (a: string) => void }) {
  const [st, setSt] = useState<Follow | undefined>();
  async function follow() {
    if (st === "busy") return;
    const was = st === "on";
    setSt("busy");
    const r = await toggleFollow(p.id, was);
    if (r === null) return setSt({ error: "Couldn't update that. Try again." });
    setSt(r ? "on" : undefined);
    if (r) onFirst("follow_matched_person");
  }
  const on = st === "on";
  return (
    <li className="rounded-2xl bg-card p-3.5">
      <div className="flex items-center gap-3">
        <Avatar url={p.avatar} name={p.name ?? p.username} size={46} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-fg">{p.name || p.username}</span>
          {p.username && <span className="block truncate text-supporting text-muted">@{p.username}</span>}
        </span>
        <button type="button" onClick={() => void follow()} disabled={st === "busy"} aria-pressed={on} className={`${PILL} ${on || st === "busy" ? "bg-surface-interactive text-fg" : "bg-fg text-bg hover:bg-fg"}`}>
          {on && <Icon name="check" weight="strong" className="size-3.5" />}
          {st === "busy" ? "…" : on ? "Following" : "Follow"}
        </button>
        <button type="button" aria-label="Dismiss" onClick={onGone} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-interactive hover:text-fg">
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <ul className="mt-2.5 space-y-0.5">
        {p.reasons.slice(0, 2).map((r) => <li key={r.code} className="text-secondary leading-[1.4] text-muted">{r.label}</li>)}
      </ul>
      {typeof st === "object" && <p role="alert" className="mt-2 text-supporting text-danger">{st.error}</p>}
    </li>
  );
}

function OppCard({ o, onFirst }: { o: Opportunity; onFirst: (a: string) => void }) {
  const [saved, setSaved] = useState(o.saved);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const viewed = useRef(false);
  if (gone) return null;

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const next = !saved;
    try {
      await opportunitiesApi.act(o.id, next ? "save" : "unsave");
      setSaved(next);
      if (next) onFirst("save_opportunity");
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function dismiss() {
    if (busy) return;
    setBusy(true);
    try {
      await opportunitiesApi.act(o.id, "dismiss");
      setGone(true);
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }
  function explore() {
    setOpen((v) => !v);
    if (!open && !viewed.current) {
      viewed.current = true;
      void opportunitiesApi.act(o.id, "view").catch(() => {});
    }
  }
  function apply() {
    if (o.apply_method !== "in_app" && o.apply_url) window.open(o.apply_url, "_blank", "noopener,noreferrer");
    void opportunitiesApi.act(o.id, "apply_click").catch(() => {});
    onFirst("apply_opportunity");
  }

  const verified = o.verification === "verified";
  const deadline = o.is_rolling ? "Rolling, no fixed deadline" : o.expires_at ? `Closes ${fmt(o.expires_at)}` : null;
  return (
    <li className="rounded-2xl bg-card p-3.5">
      <p className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">{o.kind.replace("_", " ")}{o.provider_name ? ` · ${o.provider_name}` : ""}</p>
      <h3 className="mt-1 text-[16px] font-extrabold leading-snug text-fg">{o.title}</h3>
      <p className={`mt-1.5 inline-flex items-center gap-1 text-supporting ${verified ? "font-bold text-fg" : "text-muted"}`}>
        {verified && <Icon name="verifiedCheck" filled className="size-3.5 text-brand-ink" />}
        {o.verification_label}
      </p>
      <p className="mt-2 line-clamp-3 text-secondary leading-[1.4] text-muted">{o.summary}</p>
      {deadline && <p className="mt-2 text-supporting font-semibold text-fg">{deadline}</p>}
      {o.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {o.reasons.slice(0, 3).map((r) => <li key={r.code} className="text-supporting text-muted">{r.label}</li>)}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-surface-interactive pt-3 text-secondary leading-[1.45] text-muted">
          <p><span className="font-bold text-fg">Source: </span>{o.provenance}{o.source_url && <> · <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="font-bold text-fg underline-offset-4 hover:underline">View source</a></>}</p>
          {o.requirements && <p><span className="font-bold text-fg">Requirements: </span>{o.requirements}</p>}
          {(o.location_text || o.location_mode) && <p><span className="font-bold text-fg">Where: </span>{[o.location_text, o.location_mode?.replace("_", " ")].filter(Boolean).join(" · ")}</p>}
          {o.opens_at && <p><span className="font-bold text-fg">Opens: </span>{fmt(o.opens_at)}</p>}
          {o.apply_method === "in_app" ? (
            <p>Applications for this one are handled inside Anaija, which isn&apos;t available yet.</p>
          ) : o.apply_url ? (
            <button type="button" onClick={apply} className={`${PILL} mt-1 bg-brand text-brand-fg hover:bg-brand-hover`}>
              {o.apply_method === "contact" ? "Contact the provider" : "Apply on the provider's site"}
            </button>
          ) : (
            <p>Contact the provider directly to apply.</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} aria-pressed={saved} className={`${PILL} ${saved ? "bg-surface-interactive text-fg" : "bg-fg text-bg hover:bg-fg"}`}>{saved ? "Saved" : "Save"}</button>
        <button type="button" onClick={explore} aria-expanded={open} className={`${PILL} bg-surface-interactive text-fg`}>{open ? "Hide details" : "Explore"}</button>
        <button type="button" onClick={() => void dismiss()} disabled={busy} className="h-9 px-2 text-secondary font-semibold text-muted hover:text-fg">Dismiss</button>
      </div>
      {err && <p role="alert" className="mt-2 text-supporting text-danger">{err}</p>}
    </li>
  );
}

// "Anaija reveal": what the person's own declared answers match, then Anaija's spaces. Every line says why it is here.
// Empty means empty: nothing in this step is ever invented to fill a gap.
export function RevealStep({ declared, onShown, onFirstAction, onFinish }: {
  declared: number;
  onShown: () => void;
  onFirstAction: (action: string) => void;
  onFinish: (dest: string | null) => void;
}) {
  const [people, setPeople] = useState<Load<PeopleMatches>>({ s: "loading" });
  const [opps, setOpps] = useState<Load<OpportunityList>>({ s: "loading" });
  const [hidden, setHidden] = useState<number[]>([]);
  const fired = useRef(false);

  const note = (a: string) => {
    if (fired.current) return;
    fired.current = true;
    onFirstAction(a);
  };

  useEffect(() => {
    let alive = true;
    opportunitiesApi.peopleMatches(6).then((v) => alive && setPeople({ s: "ready", v })).catch((e: unknown) => alive && setPeople({ s: "error", msg: messageOf(e) }));
    opportunitiesApi.list({ limit: 5 }).then((v) => alive && setOpps({ s: "ready", v })).catch((e: unknown) => alive && setOpps({ s: "error", msg: messageOf(e) }));
    return () => {
      alive = false;
    };
  }, []);

  const skeleton = <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3">{[0, 1].map((k) => <Sk key={k} className="h-[84px] w-full rounded-2xl" />)}</div>;
  const empty = (text: string) => <p className="rounded-2xl bg-card px-4 py-5 text-secondary leading-[1.45] text-muted">{text}</p>;

  const matched = people.s === "ready" ? people.v.data.filter((p) => !hidden.includes(p.id)) : [];
  const needMore = declared === 0 ? " Add some interests, skills or goals and matches will start to appear." : "";

  return (
    <>
      <div className="mb-8 space-y-8">
        <section aria-label="People like you">
          <h2 className={H}>People who fit what you shared</h2>
          {people.s === "loading" ? skeleton : people.s === "error" ? empty(people.msg) : matched.length > 0 ? (
            <ul className="space-y-2.5">
              {matched.map((p) => <PersonRow key={p.id} p={p} onFirst={note} onGone={() => setHidden((h) => [...h, p.id])} />)}
            </ul>
          ) : empty(
            people.v.personalization_enabled
              ? `No one matches what you've shared yet. As more people on Anaija fill in their profiles, matches will show up here.${needMore}`
              : "Personalization is off, so we aren't matching people to you.",
          )}
        </section>

        <section aria-label="Opportunities">
          <h2 className={H}>Opportunities for you</h2>
          {opps.s === "loading" ? skeleton : opps.s === "error" ? empty(opps.msg) : opps.v.data.length > 0 ? (
            <ul className="space-y-2.5">
              {opps.v.data.map((o) => <OppCard key={o.id} o={o} onFirst={note} />)}
              </ul>
          ) : empty(`Nothing is listed for you yet. We don't make opportunities up: scholarships, internships and other listings will show here once they've been added with their source.${needMore}`)}
        </section>
      </div>
      <DiscoverStep onShown={onShown} onFirstAction={note} onFinish={onFinish} />
    </>
  );
}
