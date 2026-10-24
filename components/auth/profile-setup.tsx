"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { profileApi } from "@/lib/api/profile";
import { useAuth } from "@/lib/auth/auth-context";
import { needsProfileSetup } from "@/lib/auth/guards";
import { readNext } from "@/lib/auth/next";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
type Avail = "idle" | "checking" | "ok" | "taken" | "invalid" | "unknown";

export function ProfileSetup() {
  const router = useRouter();
  const { status, user, refresh } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avail, setAvail] = useState<Avail>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef("");

  useEffect(() => {
    if (status === "guest") router.replace("/login");
    else if (status === "authed" && !needsProfileSetup(user)) router.replace(readNext());
  }, [status, user, router]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

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
        .then((ok) => {
          if (latest.current === v) setAvail(ok ? "ok" : "taken");
        })
        .catch(() => {
          if (latest.current === v) setAvail("unknown");
        });
    }, 500);
  }

  // If the availability check itself failed we still allow submit: profile-complete re-checks (409).
  const canSubmit = (avail === "ok" || avail === "unknown") && name.trim().length > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await profileApi.complete({
        username: username.trim(),
        name: name.trim(),
        bio: bio.trim() || undefined,
      });
      await refresh();
      router.replace(readNext()); // TODO(next batch): continue to school onboarding like Flutter
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setAvail("taken");
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authed" || !needsProfileSetup(user)) return <div className="min-h-dvh" />;

  const hint: Record<Avail, { text: string; cls: string }> = {
    idle: { text: "Letters, numbers and underscores", cls: "text-muted" },
    checking: { text: "Checking…", cls: "text-muted" },
    ok: { text: "Available", cls: "text-fg" },
    taken: { text: "Username taken", cls: "text-danger" },
    invalid: { text: "Only letters, numbers and underscores (max 30)", cls: "text-danger" },
    unknown: { text: "Couldn't check right now. We'll verify when you continue.", cls: "text-muted" },
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-6 py-10">
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">
        Set up your
        <br />
        profile
      </h1>
      <p className="mt-2 text-[15px] text-muted">This is how others will see you on Anaija.</p>

      <form onSubmit={submit} className="mt-9 flex flex-col gap-4">
        <input
          className={inputClass}
          placeholder="Full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <div className="relative">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[15px] text-muted">@</span>
            <input
              className={`${inputClass} pl-10`}
              placeholder="Username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => onUsername(e.target.value)}
              aria-invalid={avail === "taken" || avail === "invalid"}
            />
          </div>
          <p className={`mt-2 px-1 text-xs ${hint[avail].cls}`}>{hint[avail].text}</p>
        </div>

        <div>
          <textarea
            className="min-h-[104px] w-full resize-none rounded-input bg-surface-interactive px-5 py-4 text-[15px] font-medium text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60"
            placeholder="Bio (optional)"
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="mt-1 px-1 text-right text-xs text-muted">{bio.length}/160</p>
        </div>

        <Button type="submit" disabled={!canSubmit} className="mt-2 h-14 w-full">
          {busy ? "Saving…" : "Continue"}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
