/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useActivity } from "@/lib/activity/activity-context";
import { useAuth } from "@/lib/auth/auth-context";
import { useMessagesUnread } from "@/lib/messaging/unread-context";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { readPushState, usePush } from "@/lib/push/web-push";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type Kind = "push" | "install";
type Card = "push" | "install" | "install-ios";

const DAY = 86_400_000;
const SNOOZE_DAYS = [3, 14, 45]; // after dismissal #1, #2, #3; a 4th dismissal retires the nudge
const HIDDEN_ON = ["/login", "/setup", "/create"];

type Rec = { n: number; at: number };
const KEY = (k: Kind) => `anaija:nudge:${k}`;
function rec(k: Kind): Rec {
  try {
    const r = JSON.parse(localStorage.getItem(KEY(k)) || "") as Rec;
    return { n: Number(r.n) || 0, at: Number(r.at) || 0 };
  } catch {
    return { n: 0, at: 0 };
  }
}
function due(k: Kind): boolean {
  const r = rec(k);
  if (r.n === 0) return true;
  if (r.n > SNOOZE_DAYS.length) return false;
  return Date.now() - r.at > SNOOZE_DAYS[r.n - 1] * DAY;
}
function snooze(k: Kind) {
  try {
    localStorage.setItem(KEY(k), JSON.stringify({ n: rec(k).n + 1, at: Date.now() }));
  } catch {}
}

const BTN = "h-11 rounded-full bg-brand px-5 text-[14px] font-extrabold text-brand-fg transition active:scale-[0.97] disabled:opacity-50";
const GHOST = "h-11 rounded-full px-4 text-[14px] font-semibold text-white/70 transition-colors hover:bg-white/8 hover:text-white";

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-extrabold text-brand-fg">{n}</span>
      <span className="text-[13.5px] leading-[1.3] text-white/80">{children}</span>
    </li>
  );
}

/** One gentle, well-timed nudge per session: turn on notifications, install the app. Backs off if dismissed. */
export function AppNudges() {
  const pathname = usePathname();
  const { status } = useAuth();
  const { unseen } = useActivity();
  const { count: msgUnread } = useMessagesUnread();
  const { open: panelOpen } = useNotificationsPanel();
  const push = usePush();
  const ps = push.state;

  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true),
  );
  const [armed, setArmed] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const shown = useRef(false);
  const mountedAt = useRef(0);
  const prevTotal = useRef(0);

  useEffect(() => {
    mountedAt.current = Date.now();
    try {
      shown.current = sessionStorage.getItem("anaija:nudge-shown") === "1";
    } catch {}

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => {
      setEvt(null);
      setStandalone(true);
      setCard((c) => (c === "install" || c === "install-ios" ? null : c));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Returning visitors get a nudge after a while even if nothing arrives.
    let t: number | undefined;
    try {
      if (!sessionStorage.getItem("anaija:session")) {
        sessionStorage.setItem("anaija:session", "1");
        localStorage.setItem("anaija:visits", String(Number(localStorage.getItem("anaija:visits") || 0) + 1));
      }
      if (Number(localStorage.getItem("anaija:visits") || 0) >= 2) t = window.setTimeout(() => setArmed(true), 75_000);
    } catch {}

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (t !== undefined) window.clearTimeout(t);
    };
  }, []);

  // The best moment: something arrived while you were in the app, so you would have missed it if you were away.
  const total = unseen + msgUnread;
  useEffect(() => {
    if (total > prevTotal.current && mountedAt.current && Date.now() - mountedAt.current > 4000) setArmed(true);
    prevTotal.current = total;
  }, [total]);

  const routeOk = !HIDDEN_ON.some((p) => pathname.startsWith(p)) && !/^\/messages\/\d+/.test(pathname);

  useEffect(() => {
    if (!armed || card || shown.current || status !== "authed" || ps === null || panelOpen || !routeOk) return;
    const t = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      const c: Card | null =
        ps === "needs-install"
          ? due("install")
            ? "install-ios"
            : null
          : ps === "off" && due("push")
            ? "push"
            : !standalone && evt && due("install")
              ? "install"
              : null;
      if (!c) return;
      shown.current = true;
      try {
        sessionStorage.setItem("anaija:nudge-shown", "1");
      } catch {}
      setCard(c);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [armed, card, status, ps, panelOpen, routeOk, standalone, evt]);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      await push.toggle(true);
      if (readPushState() === "on") {
        setDone(true);
        window.setTimeout(() => {
          setCard(null);
          setDone(false);
        }, 1800);
      } else {
        snooze("push"); // dismissed or blocked in the browser prompt
        setCard(null);
      }
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Couldn't turn on notifications");
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!evt) return;
    setBusy(true);
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      setEvt(null);
      if (outcome === "dismissed") snooze("install");
      setCard(null);
    } catch {
      snooze("install");
      setCard(null);
    } finally {
      setBusy(false);
    }
  }

  function later() {
    snooze(card === "push" ? "push" : "install");
    setCard(null);
  }

  if (!card || !routeOk || panelOpen) return null;

  return (
    <div
      role="region"
      aria-label={card === "push" ? "Turn on notifications" : "Install Anaija"}
      className="anaija-nudge fixed inset-x-3 z-50 mx-auto max-w-[440px] overflow-hidden rounded-[28px] bg-surface-subtle p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/8 md:inset-x-auto md:left-24 md:mx-0 md:w-[400px]"
      style={{ bottom: "calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 12px)" }}
    >
      <button type="button" aria-label="Not now" onClick={later} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted hover:bg-white/8 hover:text-fg">
        <Icon name="close" className="size-4" />
      </button>

      {card === "push" ? (
        <>
          <div className="rounded-2xl bg-surface-interactive p-2.5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-[15px] font-extrabold text-brand-fg">A</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-fg">Amina sent you a reel</span>
                <span className="block truncate text-[12px] text-muted">&ldquo;you have to see this&rdquo;</span>
              </span>
              <span className="size-10 shrink-0 rounded-xl" style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-warm))" }} />
            </div>
          </div>
          <h2 className="mt-3.5 pr-8 text-[17px] font-extrabold tracking-tight text-fg">{done ? "You're all set" : "Never miss a message"}</h2>
          <p className="mt-1 text-[13.5px] leading-[1.4] text-white/65">
            {done
              ? "We'll let you know when something happens."
              : "Know the moment someone messages you, likes your post or asks about your listing, even when Anaija is closed."}
          </p>
          {err && <p className="mt-2 text-[12.5px] font-semibold text-danger">{err}</p>}
          {!done && (
            <div className="mt-3.5 flex items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void enable()} className={`${BTN} flex-1`}>
                {busy ? "Turning on…" : "Turn on notifications"}
              </button>
              <button type="button" onClick={later} className={GHOST}>
                Not now
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-[14px]" />
            <div className="min-w-0 pr-8">
              <h2 className="text-[17px] font-extrabold tracking-tight text-fg">{card === "install-ios" ? "Add Anaija to your Home Screen" : "Get the Anaija app"}</h2>
              <p className="mt-0.5 text-[13.5px] leading-[1.4] text-white/65">
                {card === "install-ios" ? "Do this once and you also unlock notifications on iPhone." : "One tap to open, full screen, and it feels like a native app."}
              </p>
            </div>
          </div>
          {card === "install-ios" ? (
            <>
              <ol className="mt-3.5 flex flex-col gap-2.5 rounded-2xl bg-surface-interactive p-3">
                <Step n={1}>
                  Tap the Share button <span className="mx-0.5 inline-grid translate-y-[3px] place-items-center text-brand"><ShareGlyph /></span> in Safari
                </Step>
                <Step n={2}>
                  Choose <b className="text-fg">Add to Home Screen</b>
                </Step>
                <Step n={3}>Open Anaija from your Home Screen</Step>
              </ol>
              <div className="mt-3.5 flex justify-end">
                <button type="button" onClick={later} className={BTN}>
                  Got it
                </button>
              </div>
            </>
          ) : (
            <div className="mt-3.5 flex items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void install()} className={`${BTN} flex-1`}>
                Install
              </button>
              <button type="button" onClick={later} className={GHOST}>
                Not now
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
