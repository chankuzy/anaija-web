"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { messageOf } from "@/components/community/kit";
import { Button } from "@/components/ui/button";
import { onboardingApi, type OnboardingEvent } from "@/lib/api/onboarding";
import { personalizationApi, type OnboardingStage, type PersonalizationSave, type PersonalizationState } from "@/lib/api/personalization";
import { Frame, GHOST, ORDER, PZ_ORDER } from "./frame";
import { GoalsStep, InterestsStep, OffersStep, SkillsStep } from "./pz-steps";
import { RevealStep } from "./reveal-step";

type Step = "interests" | "skills" | "goals" | "offers" | "reveal" | "off";
const FORM: OnboardingStage[] = ["interests", "skills", "goals", "offers"];
const NEXT: Partial<Record<Step, Step>> = { interests: "skills", skills: "goals", goals: "offers", offers: "reveal" };
const PREV: Partial<Record<Step, Step>> = { skills: "interests", goals: "skills", offers: "goals", reveal: "offers" };
const COPY = {
  interests: { title: "What are you into?", sub: "Pick what you like. It helps us find people, spaces and opportunities for you. Change it any time." },
  skills: { title: "What can you do, or want to learn?", sub: "Add your skills and say how you relate to each. Only you decide what's saved and who sees it." },
  goals: { title: "What are you looking for?", sub: "Jobs, clients, mentors, collaborators, scholarships. Pick what fits right now." },
  offers: { title: "Anything you offer?", sub: "A service, a project, mentoring, a business. Optional, and you choose who sees it." },
} as const;
const uniq = <T,>(a: T[]) => [...new Set(a)];

// Personalization stages after campus: interests > skills > goals > offers > reveal. Each step saves as it goes and records
// done/skipped, so it can be left and resumed. standalone = an existing user who came from the home prompt.
export function PersonalizeFlow({ standalone, onBack }: { standalone: boolean; onBack?: () => void }) {
  const router = useRouter();
  const [pz, setPz] = useState<PersonalizationState | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [step, setStep] = useState<Step>("interests");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ev = useCallback((e: Omit<OnboardingEvent, "source">) => {
    if (!standalone) onboardingApi.event({ ...e, source: "direct" });
  }, [standalone]);

  useEffect(() => {
    let alive = true;
    personalizationApi
      .get()
      .then((s) => {
        if (!alive) return;
        const p = s.profile;
        setPz(s);
        if (!p.personalization_enabled) return setStep("off");
        const handled = new Set<OnboardingStage>([...p.stage_done, ...p.stage_skipped]);
        setStep(p.completed ? "interests" : ((FORM.find((x) => !handled.has(x)) as Step | undefined) ?? "reveal"));
      })
      .catch((e: unknown) => alive && setLoadErr(messageOf(e)));
    return () => {
      alive = false;
    };
  }, [tries]);

  async function commit(stage: OnboardingStage, done: boolean, section: PersonalizationSave = {}): Promise<boolean> {
    if (!pz || busy) return false;
    const p = pz.profile;
    setBusy(true);
    setErr(null);
    try {
      const s = await personalizationApi.save({
        ...section,
        stage_done: done ? uniq([...p.stage_done, stage]) : p.stage_done.filter((x) => x !== stage),
        stage_skipped: done ? p.stage_skipped.filter((x) => x !== stage) : uniq([...p.stage_skipped, stage]),
      });
      setPz(s);
      return true;
    } catch (e) {
      setErr(messageOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function advance(from: Step, section: PersonalizationSave) {
    if (await commit(from as OnboardingStage, true, section)) setStep(NEXT[from] ?? "reveal");
  }
  async function skip(from: Step) {
    if (await commit(from as OnboardingStage, false)) setStep(NEXT[from] ?? "reveal");
  }

  async function skipAll() {
    if (!pz || busy) return;
    setBusy(true);
    try {
      await personalizationApi.save({
        stage_skipped: uniq([...pz.profile.stage_skipped, ...FORM]),
        stage_done: pz.profile.stage_done.filter((s) => !FORM.includes(s)),
      });
    } catch {}
    ev({ kind: "complete" });
    router.replace("/");
  }

  async function finish(dest: string | null) {
    const p = pz?.profile;
    if (p) {
      await personalizationApi
        .save({ complete: true, stage_done: uniq([...p.stage_done, "reveal" as OnboardingStage]), stage_skipped: p.stage_skipped.filter((s) => s !== "reveal") })
        .catch(() => {});
    }
    ev({ kind: "step_done", step: "discovery" });
    ev({ kind: "complete" });
    router.replace(dest ?? "/");
  }

  const steps = standalone ? PZ_ORDER : ORDER;
  if (loadErr) {
    return (
      <Frame stage="interests" steps={steps} title="Couldn't load this." sub={loadErr}>
        <div className="mt-auto flex flex-col gap-1">
          <Button onClick={() => { setLoadErr(null); setTries((t) => t + 1); }} className="h-14 w-full">Try again</Button>
          <button type="button" onClick={() => router.replace("/")} className={GHOST}>Not now</button>
        </div>
      </Frame>
    );
  }
  if (!pz) return <div className="min-h-dvh" />;

  if (step === "off") {
    return (
      <Frame stage="interests" steps={steps} title="Personalization is off." sub="While it's off, Anaija doesn't use what you declare to match you with people or opportunities.">
        <div className="mt-auto flex flex-col gap-1">
          {err && <p role="alert" className="pb-3 text-center text-secondary text-danger">{err}</p>}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const s = await personalizationApi.save({ personalization_enabled: true });
                setPz(s);
                setStep("interests");
              } catch (e) {
                setErr(messageOf(e));
              } finally {
                setBusy(false);
              }
            }}
            className="h-14 w-full"
          >
            Turn it on
          </Button>
          <button type="button" onClick={() => router.replace("/")} className={GHOST}>Keep it off</button>
        </div>
      </Frame>
    );
  }

  const back = step === "interests" ? onBack : () => setStep(PREV[step] ?? "interests");
  const common = { pz, busy, err };

  if (step === "reveal") {
    const p = pz.profile;
    return (
      <Frame stage="reveal" steps={steps} title="Here's what fits you." sub="Everything below comes from what you told us. Nothing is made up." onBack={back}>
        <RevealStep
          declared={p.interests.length + p.seeking.length + p.skills.length + p.offers.length}
          onShown={() => ev({ kind: "discovery_shown", step: "discovery" })}
          onFirstAction={(action) => ev({ kind: "first_action", step: "discovery", action })}
          onFinish={(dest) => void finish(dest)}
        />
      </Frame>
    );
  }

  const c = COPY[step];
  return (
    <Frame stage={step} steps={steps} title={c.title} sub={c.sub} onBack={back}>
      {step === "interests" && <InterestsStep {...common} onSave={(s) => void advance("interests", s)} onSkip={() => void skip("interests")} onSkipAll={standalone ? undefined : () => void skipAll()} />}
      {step === "skills" && <SkillsStep {...common} onSave={(s) => void advance("skills", s)} onSkip={() => void skip("skills")} />}
      {step === "goals" && <GoalsStep {...common} onSave={(s) => void advance("goals", s)} onSkip={() => void skip("goals")} />}
      {step === "offers" && <OffersStep {...common} onSave={(s) => void advance("offers", s)} onSkip={() => void skip("offers")} />}
    </Frame>
  );
}
