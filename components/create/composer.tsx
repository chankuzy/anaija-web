"use client";

// Composer shell. Owns the step machine. Below md it is a full-screen overlay (like a pushed route in Flutter),
// so the app shell's tab bar stays out of the way. From md up it is a contained studio panel inside <main>,
// beside the rail: fixed height, internal scrolling, and the page itself is never locked.
// Reel, Story and Listing share the same pick -> edit -> publish flow; listing fields live in the publish step.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import type { ContentKind } from "@/lib/create/types";
import { useComposer } from "@/lib/create/use-composer";
import { EditorStep } from "./editor-step";
import { PickStep } from "./pick-step";
import { PublishStep } from "./publish-step";
import { ExitSheet, Toast } from "./ui";

type Step = "pick" | "edit" | "publish";

export function Composer({ initialKind }: { initialKind: ContentKind }) {
  const router = useRouter();
  const { status } = useAuth();
  const c = useComposer(initialKind);
  const [step, setStep] = useState<Step>("pick");
  const [exiting, setExiting] = useState(false);

  const leave = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.replace("/");
  }, [router]);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  // Only the mobile overlay locks page scroll; the desktop studio scrolls inside its own panel.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const prev = document.body.style.overflow;
    const sync = () => {
      document.body.style.overflow = mq.matches ? "hidden" : prev;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.overflow = prev;
    };
  }, []);

  const media = c.draft.media;
  const videoOnly = media.length > 0 && media.every((m) => m.type === "video");

  const close = useCallback(() => {
    if (c.busy) return;
    if (media.length === 0) leave();
    else setExiting(true);
  }, [c.busy, leave, media.length]);

  const fromPick = () => {
    if (!media.length) return;
    // Multi-photo reels slide by default (same as the Flutter editor's initState).
    if (!videoOnly && media.length > 1 && c.draft.kind === "reel" && !c.draft.slideshow.enabled) {
      c.update({ slideshow: { ...c.draft.slideshow, enabled: true } });
    }
    setStep(videoOnly ? "publish" : "edit");
  };

  if (status !== "authed") return <div className="fixed inset-0 z-[60] bg-bg md:static md:inset-auto md:z-auto md:h-dvh md:bg-transparent" />;

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-bg md:static md:inset-auto md:z-auto md:h-[calc(100dvh-var(--nav-h,0px))] md:w-full md:items-center md:bg-transparent md:px-6">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col md:h-[min(880px,calc(100dvh-48px))] md:max-w-[760px] md:overflow-hidden md:rounded-[28px] md:border md:border-white/8 md:bg-bg"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {step === "pick" && <PickStep c={c} onNext={fromPick} onClose={close} />}
        {step === "edit" && <EditorStep c={c} onBack={() => setStep("pick")} onNext={() => setStep("publish")} />}
        {step === "publish" && <PublishStep c={c} onBack={() => setStep(videoOnly ? "pick" : "edit")} onDone={leave} />}
      </div>

      {exiting && (
        <ExitSheet
          onKeep={() => setExiting(false)}
          onDiscard={leave}
          onSave={async () => {
            if (await c.saveDraft()) leave();
            else setExiting(false);
          }}
        />
      )}
      <Toast toast={c.toast} />
    </div>
  );
}
