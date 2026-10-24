"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { settingsApi } from "@/lib/api/settings";
import { SectionLabel, SettingsPage, useRequireAuth } from "./settings-kit";

const CATS = [
  ["bug", "Bug"],
  ["account", "Account"],
  ["marketplace", "Marketplace"],
  ["safety", "Safety"],
  ["suggestion", "Suggestion"],
] as const;

export function ReportView() {
  const ready = useRequireAuth();
  const [cat, setCat] = useState<string>("bug");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = text.trim().length >= 10;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await settingsApi.report(cat, text.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <div className="min-h-dvh" />;

  return (
    <SettingsPage title="Report a problem" backHref="/settings">
      {sent ? (
        <div className="py-16 text-center">
          <p className="text-[20px] font-bold text-white">Thanks, we got your report</p>
          <p className="mt-1 text-body text-muted">We&apos;ll look into it.</p>
          <LinkButton href="/settings" className="mt-6 px-8">
            Back to settings
          </LinkButton>
        </div>
      ) : (
        <form onSubmit={send}>
          <SectionLabel>What is it about?</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CATS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCat(value)}
                className={`rounded-full border px-4 py-2 text-[14px] transition ${
                  cat === value ? "border-white/40 bg-white/14 font-bold text-white" : "border-white/14 font-medium text-white/70 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-6" />
          <SectionLabel>Tell us more</SectionLabel>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={cat === "safety" ? "Include their username and what happened" : "What happened? What did you expect?"}
            className="min-h-[160px] w-full resize-none rounded-input border border-line bg-card px-5 py-4 text-[15px] leading-[1.4] text-fg outline-none placeholder:text-muted focus-visible:ring-1 focus-visible:ring-white/20"
          />
          <p className="mt-1 px-1 text-right text-supporting text-muted">{text.length}/1000</p>

          <Button type="submit" disabled={!valid || busy} className="mt-4 w-full">
            {busy ? "Sending…" : "Send report"}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-body text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </SettingsPage>
  );
}
