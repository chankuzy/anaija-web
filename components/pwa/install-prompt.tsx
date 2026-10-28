/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "anaija-install-dismissed";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const HIDDEN_ON = ["/create", "/login"];

const IOS_RE = /iphone|ipad|ipod/i;
const noSub = () => () => {};
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const snoozed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
};

const iosEligible = () => !isStandalone() && !snoozed() && IOS_RE.test(navigator.userAgent);

export function InstallPrompt() {
  const pathname = usePathname();
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const ios = useSyncExternalStore(noSub, iosEligible, () => false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      if (isStandalone() || snoozed()) return;
      e.preventDefault();
      setEvt(e as InstallEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === "dismissed") dismiss();
    else setHidden(true);
  };

  if (hidden || (!evt && !ios) || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div
      role="region"
      aria-label="Install Anaija"
      className="fixed inset-x-3 z-50 mx-auto flex max-w-[420px] items-center gap-3 rounded-floating bg-surface-interactive p-3 shadow-[0_8px_28px_rgba(0,0,0,0.5)] md:left-auto md:right-6 md:mx-0 md:w-[380px]"
      style={{ bottom: "calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 12px)" }}
    >
      <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-fg">Install Anaija</p>
        <p className="text-[12px] leading-[1.35] text-muted">
          {evt ? "Add it to your home screen for a faster, full-screen experience." : "Tap Share, then Add to Home Screen."}
        </p>
      </div>
      {evt && (
        <button type="button" onClick={() => void install()} className="h-9 shrink-0 rounded-full bg-brand px-4 text-[13px] font-extrabold text-brand-fg">
          Install
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white/8">
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}
