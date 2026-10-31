"use client";

import { openAuth } from "@/lib/auth/auth-modal";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { structuredOf } from "@/lib/feed/structured";
import { usePoll } from "@/lib/feed/use-poll";
import type { BodyProps } from "./types";

const plural = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`;

// Used in Home and on the reader page. Voting is final; results appear once you vote, when the poll closes,
// or for the author (the server decides, the card only draws what it is given).
export function PollCard({ post, onOpen }: { post: Post; onOpen?: () => void }) {
  const { status } = useAuth();
  const authed = status === "authed";
  const c = structuredOf(post);
  const poll = c?.kind === "poll" ? c : null;
  const { state, vote } = usePoll(post.id, !!poll && authed);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!poll) return null;

  const showResults = !!state?.counts;
  const total = state?.total ?? 0;
  const mine = state?.mine ?? [];
  // Unknown state (still loading, or the state call failed) must not lock voting: the server validates the vote.
  const canVote = authed && (state ? state.can_vote : true);

  const toggle = (id: number) => {
    if (!authed) return openAuth();
    if (!canVote || busy) return;
    setPicked((p) => (poll.multiple ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  };
  const submit = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await vote(picked);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not record your vote.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-image bg-surface-subtle p-4">
      <button type="button" onClick={onOpen} disabled={!onOpen} className="block w-full text-left disabled:cursor-default">
        <span className="text-[19px] font-bold leading-[1.3] tracking-tight text-fg">{poll.question}</span>
      </button>
      <p className="mt-1 text-supporting text-muted">
        {state?.closed ? "Final results" : poll.multiple ? "Select all that apply" : "Select one"}
      </p>

      <div className="mt-3 space-y-2">
        {poll.options.map((o) => {
          if (showResults) {
            const n = state?.counts?.[o.id] ?? 0;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            const isMine = mine.includes(o.id);
            return (
              <div key={o.id} className="relative overflow-hidden rounded-2xl bg-surface-interactive">
                <div className="absolute inset-y-0 left-0 bg-brand/25" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center gap-2 px-4 py-3.5 text-body">
                  <span className={`min-w-0 flex-1 truncate ${isMine ? "font-bold text-fg" : "text-fg"}`}>{o.text}</span>
                  {isMine && <Icon name="check" className="size-4 shrink-0 text-brand" />}
                  <span className="shrink-0 tabular-nums text-secondary font-semibold text-muted">{pct}%</span>
                </div>
              </div>
            );
          }
          const on = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              onClick={() => toggle(o.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-body transition-colors disabled:opacity-60 ${
                on ? "bg-brand/15 text-fg" : "bg-surface-interactive text-fg hover:bg-surface-elevated"
              }`}
            >
              <span className={`grid size-5 shrink-0 place-items-center rounded-full ${on ? "bg-brand text-brand-fg" : "bg-white/10"}`}>
                {on && <Icon name="check" className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">{o.text}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-supporting text-muted">
          {showResults ? plural(total) : authed ? "Vote to see results" : "Sign in to vote"}
          {poll.closes_at && !state?.closed && (
            <span suppressHydrationWarning>
              {" · closes "}
              {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(poll.closes_at))}
            </span>
          )}
        </p>
        {canVote && !showResults && (
          <button
            type="button"
            disabled={!picked.length || busy}
            onClick={() => void submit()}
            className="h-10 shrink-0 rounded-pill bg-brand px-5 text-secondary font-extrabold text-brand-fg disabled:opacity-40"
          >
            {busy ? "Voting…" : "Vote"}
          </button>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-2 text-supporting text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

export function PollBody({ post, onOpen }: BodyProps) {
  return <PollCard post={post} onOpen={onOpen} />;
}
