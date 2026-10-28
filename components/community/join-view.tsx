"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
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
  const pv = useFetch(status === "loading" ? null : `inv:${token}:${status}`, () => communitiesApi.invitePreview(token));
  const next = `/join/${token}`;
  const p = pv.data;

  async function redeem() {
    setBusy(true);
    setErr(null);
    try {
      const r = await communitiesApi.redeem(token);
      reloadInbox();
      router.replace(r.slug ? `/c/${r.slug}` : "/communities");
    } catch (e) {
      setErr(messageOf(e));
      setBusy(false);
    }
  }

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
        <>
          <span className="mx-auto"><Avatar url={p.community.avatar} name={p.community.name} size={96} /></span>
          <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">You&apos;re invited to join</p>
          <h1 className="mt-1.5 text-[26px] font-extrabold leading-[1.15] tracking-tight text-fg">{p.community.name}</h1>
          <p className="mt-1.5 text-secondary text-muted">{p.community.members_count} {p.community.members_count === 1 ? "member" : "members"}</p>
          {p.is_member ? (
            <Link href={`/c/${p.community.slug}`} className={buttonClass("primary", "mt-7 h-12 w-full")}>Open community</Link>
          ) : status === "authed" ? (
            <button type="button" disabled={busy} onClick={() => void redeem()} className={buttonClass("primary", "mt-7 h-12 w-full")}>{busy ? "Joining…" : "Join community"}</button>
          ) : (
            <>
              <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass("primary", "mt-7 h-12 w-full")}>Sign in to join</Link>
              <p className="mt-3 text-supporting leading-[1.4] text-muted">New to Anaija? Signing in creates your account and brings you straight back here.</p>
            </>
          )}
          {err && <p role="alert" className="mt-4 text-secondary text-danger">{err}</p>}
        </>
      )}
    </div>
  );
}
