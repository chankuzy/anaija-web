"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { onboardingApi, type InvitePeek, type OnboardingEvent, type OnboardingSource } from "@/lib/api/onboarding";
import { profileApi } from "@/lib/api/profile";
import { useAuth } from "@/lib/auth/auth-context";
import { needsProfileSetup } from "@/lib/auth/guards";
import { readNext } from "@/lib/auth/next";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { CampusStep } from "@/components/onboarding/campus-step";
import { DiscoverStep } from "@/components/onboarding/discover-step";
import { Frame, type Stage } from "@/components/onboarding/frame";
import { PhotoStep } from "@/components/onboarding/photo-step";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const JOIN_RE = /^\/join\/([A-Za-z0-9]+)/;
type Avail = "idle" | "checking" | "ok" | "taken" | "invalid" | "unknown";

// First-session flow: profile -> photo -> campus -> discovery. Every step after the first is skippable, and an invite
// link (?next=/join/<token>) is carried through and returned to, so a lecturer's link never dumps anyone on the feed.
export function ProfileSetup() {
  const router = useRouter();
  const { status, user, refresh } = useAuth();
  const [next] = useState(() => (typeof window === "undefined" ? "/" : readNext()));
  const token = JOIN_RE.exec(next)?.[1] ?? null;

  const [stage, setStage] = useState<Stage>("profile");
  const [began, setBegan] = useState(false); // once the profile is saved, needsProfileSetup flips: don't redirect away
  const [invite, setInvite] = useState<InvitePeek | null>(null);
  const source = useRef<OnboardingSource>(token ? "invite_community" : "direct");
  const started = useRef(false);

  const [name, setName] = useState(() => user?.name ?? "");
  const [username, setUsername] = useState("");
  const [avail, setAvail] = useState<Avail>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef("");

  const ev = useCallback((e: Omit<OnboardingEvent, "source">) => onboardingApi.event({ ...e, source: source.current }), []);

  useEffect(() => {
    if (status === "guest") router.replace(`/login?next=${encodeURIComponent(next)}`);
    else if (status === "authed" && !began && !needsProfileSetup(user)) router.replace(next);
  }, [status, user, began, next, router]);

  // "start" is the first honest signal we can record: someone with an account who reached setup.
  useEffect(() => {
    if (started.current || status !== "authed" || !needsProfileSetup(user)) return;
    started.current = true;
    if (!token) return ev({ kind: "start" });
    onboardingApi
      .invitePeek(token)
      .then((p) => {
        source.current = p.kind === "course_desk" ? "invite_desk" : "invite_community";
        setInvite(p);
      })
      .catch(() => {})
      .finally(() => ev({ kind: "start" }));
  }, [status, user, token, ev]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  function onUsername(raw: string) {
    setUsername(raw);
    setError(null);
    if (timer.current !== null) window.clearTimeout(timer.current);
    const v = raw.trim();
    latest.current = v;
    if (v.length < 3) return setAvail("idle");
    if (v.length > 30 || !USERNAME_RE.test(v)) return setAvail("invalid");
    setAvail("checking");
    timer.current = window.setTimeout(() => {
      profileApi
        .usernameAvailable(v)
        .then((ok) => latest.current === v && setAvail(ok ? "ok" : "taken"))
        .catch(() => latest.current === v && setAvail("unknown"));
    }, 500);
  }

  const canSubmit = (avail === "ok" || avail === "unknown") && name.trim().length > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await profileApi.complete({ username: username.trim(), name: name.trim() });
      setBegan(true);
      await refresh();
      ev({ kind: "step_done", step: "profile" });
      setStage("photo");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setAvail("taken");
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const finish = useCallback((dest: string | null) => {
    ev({ kind: "complete" });
    router.replace(dest ?? "/");
  }, [ev, router]);

  const onShown = useCallback(() => ev({ kind: "discovery_shown", step: "discovery" }), [ev]);

  if (status !== "authed" || (!began && !needsProfileSetup(user))) return <div className="min-h-dvh" />;

  const hint: Record<Avail, { text: string; cls: string }> = {
    idle: { text: "Letters, numbers and underscores", cls: "text-muted" },
    checking: { text: "Checking…", cls: "text-muted" },
    ok: { text: "Available", cls: "text-fg" },
    taken: { text: "Username taken", cls: "text-danger" },
    invalid: { text: "Only letters, numbers and underscores (max 30)", cls: "text-danger" },
    unknown: { text: "Couldn't check right now. We'll verify when you continue.", cls: "text-muted" },
  };

  if (stage === "photo") {
    return (
      <Frame stage="photo" title="Give your profile a face." sub="Let people recognize you around Anaija. You can always change this later.">
        <PhotoStep
          onContinue={(a) => {
            ev({ kind: a === "done" ? "step_done" : "step_skip", step: "photo" });
            setStage("campus");
          }}
        />
      </Frame>
    );
  }

  if (stage === "campus") {
    const desk = invite?.desk;
    return (
      <Frame
        stage="campus"
        title="Where do you study?"
        sub={desk?.institution_only ? `This Course Desk is for students of ${desk.institution?.short_name ?? desk.institution?.name}.` : "This is how we find the classes and people that matter to you."}
      >
        <CampusStep
          invite={invite}
          onSaved={() => {
            ev({ kind: "step_done", step: "campus" });
            if (token) finish(next);
            else setStage("discover");
          }}
          onSkip={() => {
            ev({ kind: "step_skip", step: "campus" });
            finish(token ? next : null);
          }}
        />
      </Frame>
    );
  }

  if (stage === "discover") {
    return (
      <Frame stage="discover" title="Find your place." sub="Spaces that match your campus, department and level.">
        <DiscoverStep
          onShown={onShown}
          onFirstJoin={(kind) => ev({ kind: "first_action", step: "discovery", action: `join_${kind}` })}
          onFinish={(dest) => {
            ev({ kind: "step_done", step: "discovery" });
            finish(dest);
          }}
        />
      </Frame>
    );
  }

  return (
    <Frame stage="profile" title="Welcome to Anaija." sub="Two things and you're in. Everything else can wait.">
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <div>
          <label htmlFor="su-name" className="px-1 pb-2 text-micro font-semibold uppercase tracking-[0.08em] text-muted">Your name</label>
          <input id="su-name" className={`${inputClass} mt-2`} placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="su-user" className="px-1 pb-2 text-micro font-semibold uppercase tracking-[0.08em] text-muted">Username</label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[15px] text-muted">@</span>
            <input
              id="su-user"
              className={`${inputClass} pl-10`}
              placeholder="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => onUsername(e.target.value)}
              aria-invalid={avail === "taken" || avail === "invalid"}
              aria-describedby="su-hint"
            />
          </div>
          <p id="su-hint" aria-live="polite" className={`mt-2 px-1 text-xs ${hint[avail].cls}`}>{hint[avail].text}</p>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={!canSubmit} className="mt-auto h-14 w-full">{busy ? "Saving…" : "Continue"}</Button>
      </form>
    </Frame>
  );
}
