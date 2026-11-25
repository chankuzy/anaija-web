"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { personalizationApi } from "@/lib/api/personalization";
import { useAuth } from "@/lib/auth/auth-context";

const DAY = 86_400_000;
const SNOOZE_DAYS = [7, 30]; // after dismissal #1 and #2; a 3rd dismissal retires the prompt for good

type Rec = { n: number; at: number };
const KEY = (k: string) => `anaija:prompt:${k}`;
function rec(k: string): Rec {
  try {
    const r = JSON.parse(localStorage.getItem(KEY(k)) || "") as Rec;
    return { n: Number(r.n) || 0, at: Number(r.at) || 0 };
  } catch {
    return { n: 0, at: 0 };
  }
}
function due(k: string): boolean {
  const r = rec(k);
  if (r.n === 0) return true;
  if (r.n > SNOOZE_DAYS.length) return false;
  return Date.now() - r.at > SNOOZE_DAYS[r.n - 1] * DAY;
}
function snooze(k: string) {
  try {
    localStorage.setItem(KEY(k), JSON.stringify({ n: rec(k).n + 1, at: Date.now() }));
  } catch {}
}
function visitCount(): number {
  try {
    return Number(localStorage.getItem("anaija:visits") || 0);
  } catch {
    return 0;
  }
}

type Prompt = { k: string; title: string; body: string; cta: string; href: string };

// Whichever single thing is missing and most useful. Never more than one card, never a prerequisite for anything.
function pick(u: { institution_id: number | null; avatar: string | null; bio: string | null }, personalize: boolean): Prompt | null {
  const list: Prompt[] = [];
  if (!u.institution_id) list.push({ k: "campus", title: "Find your classmates", body: "Add your campus and we'll show you the communities and Course Desks for your department and level.", cta: "Add my campus", href: "/settings/campus" });
  if (personalize) list.push({ k: "personalize", title: "Make Anaija yours", body: "Tell us your interests, skills and goals and we'll match you with people and opportunities. You choose what's saved.", cta: "Personalize", href: "/setup?personalize=1" });
  if (!u.avatar) list.push({ k: "photo", title: "Give your profile a face", body: "Let people recognize you around Anaija.", cta: "Add a photo", href: "/settings/edit" });
  if (!u.bio) list.push({ k: "bio", title: "Say a little about yourself", body: "A short bio helps people know who you are.", cta: "Add a bio", href: "/settings/edit" });
  return list.find((p) => due(p.k)) ?? null;
}

export function ProfilePrompt() {
  const { status, user } = useAuth();
  const [gone, setGone] = useState(false);
  const [personalize, setPersonalize] = useState(false);
  const ready = status === "authed" && !!user?.profile_completed;

  // Offered only when personalization is on and the person hasn't finished it, or finished with nothing declared.
  useEffect(() => {
    if (!ready || visitCount() < 2 || !due("personalize")) return;
    let alive = true;
    personalizationApi
      .get()
      .then((s) => {
        const p = s.profile;
        const empty = p.interests.length + p.seeking.length + p.skills.length + p.offers.length === 0;
        if (alive) setPersonalize(p.personalization_enabled && (!p.completed || empty));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready]);

  if (gone || !ready || !user) return null;
  if (visitCount() < 2) return null;
  const p = pick(user, personalize);
  if (!p) return null;

  return (
    <section aria-label={p.title} className="sv-rise relative mx-3 mb-4 rounded-2xl bg-surface-subtle p-4 md:mx-0">
      <button type="button" aria-label="Not now" onClick={() => { snooze(p.k); setGone(true); }} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-interactive hover:text-fg">
        <Icon name="close" className="size-4" />
      </button>
      <h2 className="pr-8 text-[15px] font-extrabold tracking-tight text-fg">{p.title}</h2>
      <p className="mt-1 pr-6 text-secondary leading-[1.4] text-muted">{p.body}</p>
      <Link href={p.href} className="mt-3 inline-flex h-10 items-center rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg transition-transform active:scale-[0.97]">
        {p.cta}
      </Link>
    </section>
  );
}
