"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi } from "@/lib/api/communities";
import type { InvitePeek } from "@/lib/api/onboarding";
import { useAuth } from "@/lib/auth/auth-context";
import { openAuth } from "@/lib/auth/auth-modal";
import { messageOf, useFetch } from "./kit";

const BAD: Record<string, string> = {
  invalid: "This invitation isn't valid. It may have been revoked.",
  expired: "This invitation has expired. Ask for a new link.",
  exhausted: "This invitation has reached its limit. Ask for a new link.",
};

export function JoinView({ token }: { token: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const { reloadInbox } = useMessages();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const pv = useFetch(status === "loading" ? null : `inv:${token}:${status}`, () => communitiesApi.invitePreview(token));
  const next = `/join/${token}`;
  const p = pv.data as InvitePeek | undefined;
  const desk = p?.kind === "course_desk" ? p.desk : null;
  const request = p?.join_mode === "request";
  const ineligible = status === "authed" && p?.eligible === false;
  const campus = desk?.institution?.short_name ?? desk?.institution?.name ?? null;

  async function redeem() {
    setBusy(true);
    setErr(null);
    try {
      const r = await communitiesApi.redeem(token);
      reloadInbox();
      if (r.result === "requested" || r.result === "already_requested") {
        setSent(true);
        setBusy(false);
        return;
      }
      router.replace(r.slug ? `/c/${r.slug}` : "/communities");
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }

  const facts = desk
    ? [desk.course_code, campus, desk.department, desk.level ? `${desk.level} level` : null].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-6 py-10 text-center">
      {!p ? (
        pv.error ? (
          <p className="text-secondary text-danger">{pv.error}</p>
        ) : (
          <div role="status" aria-busy="true" aria-label="Loading invitation" className="flex flex-col items-center gap-4">
            <Sk className="size-24 rounded-full" />
            <Sk className="h-6 w-48 rounded-full" />
            <Sk className="h-12 w-full rounded-full" />
          </div>
        )
      ) : p.state !== "valid" || !p.community ? (
        <>
          <p className="text-[20px] font-extrabold text-fg">Invitation unavailable</p>
          <p className="mt-2 text-secondary leading-[1.45] text-muted">{BAD[p.state] ?? BAD.invalid}</p>
          <Link href="/communities" className={buttonClass("outline", "mx-auto mt-6 h-11 px-6")}>Browse communities</Link>
        </>
      ) : (
        <div className="sv-rise">
          <span className="mx-auto block w-fit"><Avatar url={p.community.avatar} name={p.community.name} size={96} /></span>
          <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">{desk ? "Course Desk" : "You're invited to join"}</p>
          <h1 className="mt-1.5 text-[26px] font-extrabold leading-[1.15] tracking-tight text-fg">{desk ? desk.course_title : p.community.name}</h1>
          {facts && <p className="mt-1.5 text-secondary leading-snug text-muted">{facts}</p>}
          {desk?.verified && (
            <p className="mt-2 inline-flex items-center gap-1 text-supporting font-semibold text-brand-ink">
              <Icon name="verifiedCheck" filled className="size-4" /> Run by the verified course lecturer
            </p>
          )}
          {p.community.members_count > 0 && (
            <p className="mt-1.5 text-secondary text-muted">{p.community.members_count} {p.community.members_count === 1 ? "member" : "members"}</p>
          )}
          {desk && (
            <p className="mx-auto mt-3 max-w-[320px] text-supporting leading-[1.45] text-muted">
              {desk.institution_only && campus ? `Only students of ${campus} can join. ` : ""}
              {request ? "The course team approves each request." : ""}
            </p>
          )}

          {sent ? (
            <>
              <p role="status" className="mt-7 text-[15px] font-bold text-fg">Request sent</p>
              <p className="mt-1 text-secondary text-muted">You&apos;ll be notified when the course team approves it.</p>
              <Link href="/" className={buttonClass("outline", "mt-5 h-11 w-full")}>Go to Anaija</Link>
            </>
          ) : p.is_member ? (
            <Link href={`/c/${p.community.slug}`} className={buttonClass("primary", "mt-7 h-12 w-full")}>Open {desk ? "Course Desk" : "community"}</Link>
          ) : status === "authed" ? (
            ineligible ? (
              <>
                <p className="mt-7 text-secondary leading-[1.45] text-fg">This Course Desk is for students of {campus ?? "its institution"}. Add your campus to your profile to join.</p>
                <Link href="/settings/campus" className={buttonClass("primary", "mt-4 h-12 w-full")}>Update my campus</Link>
              </>
            ) : (
              <button type="button" disabled={busy} onClick={() => void redeem()} className={buttonClass("primary", "mt-7 h-12 w-full")}>
                {busy ? (request ? "Sending…" : "Joining…") : request ? "Request to join" : desk ? "Join Course Desk" : "Join community"}
              </button>
            )
          ) : (
            <>
              <button type="button" onClick={() => openAuth({ mode: "join", next })} className={buttonClass("primary", "mt-7 h-12 w-full")}>
                Create account to {request ? "request access" : "join"}
              </button>
              <button type="button" onClick={() => openAuth({ mode: "signin", next, reason: "Sign in to continue to this invitation." })} className="mt-2 h-11 w-full rounded-full text-[15px] font-semibold text-muted transition-colors hover:text-fg">
                I already have an account
              </button>
              <p className="mt-2 text-supporting leading-[1.4] text-muted">It takes a few seconds, and brings you straight back here.</p>
            </>
          )}
          {err && <p role="alert" className="mt-4 text-secondary text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}
