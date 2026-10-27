"use client";

import { useCallback, useEffect, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import type { StructuredCreateKind } from "@/lib/create/kinds";
import { useCapabilities } from "@/lib/create/use-capabilities";
import { AnnouncementForm } from "./announcement-form";
import { DocumentForm } from "./document-form";
import { PollForm } from "./poll-form";
import { PublicationForm } from "./publication-form";

const FORMS: Record<StructuredCreateKind, ComponentType<{ onClose: () => void }>> = {
  document: DocumentForm,
  poll: PollForm,
  article: PublicationForm,
  announcement: AnnouncementForm,
};

// Same frame as the media composer: full-screen overlay below md, a contained studio panel from md up.
export function StructuredComposer({ kind }: { kind: StructuredCreateKind }) {
  const router = useRouter();
  const { status } = useAuth();
  const { caps, loaded } = useCapabilities();

  useEffect(() => {
    if (status === "guest") router.replace(loginHref());
  }, [status, router]);

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

  const leave = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.replace("/");
  }, [router]);

  const Form = FORMS[kind];
  const ready = status === "authed" && loaded;
  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-bg md:static md:inset-auto md:z-auto md:h-[calc(100dvh-var(--nav-h,0px))] md:w-full md:items-center md:bg-transparent md:px-6">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col md:h-[min(880px,calc(100dvh-48px))] md:max-w-[760px] md:overflow-hidden md:rounded-[28px] md:bg-bg"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {!ready ? null : caps?.kinds[kind] ? (
          <Form onClose={leave} />
        ) : (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div>
              <p className="text-[17px] font-bold text-fg">Not available</p>
              <p className="mt-1.5 text-secondary text-muted">This content type is not available for your account yet.</p>
              <button type="button" onClick={leave} className="mt-5 h-11 rounded-full bg-surface-interactive px-6 text-secondary font-bold text-fg">
                Go back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
