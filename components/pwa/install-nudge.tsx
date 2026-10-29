/* eslint-disable @next/next/no-img-element */
"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { promptInstall, useInstall, type InstallInfo } from "@/lib/pwa/install";

const FIRST_MS = 6_000; // first sheet, after every page load
const REPEAT_MS = 90_000; // and again this long after each "Not now"
const NO_BAR = [/^\/login/, /^\/setup/, /^\/create/, /^\/watch/, /^\/messages\/\d+/, /^\/c\/[^/]+\/chat/];
const NO_SHEET = [/^\/login/, /^\/setup/, /^\/create/, /^\/messages\/\d+/, /^\/c\/[^/]+\/chat/];

const PRIMARY = "h-12 w-full rounded-full bg-brand px-5 text-[15px] font-extrabold text-brand-fg transition active:scale-[0.98] disabled:opacity-60";
const GHOST = "h-11 w-full rounded-full text-[14px] font-semibold text-white/70 transition-colors hover:bg-white/8 hover:text-white";

const BENEFITS: [IconName, string][] = [
  ["bell", "Instant notifications for messages and likes"],
  ["galleryWide", "Full screen, with no browser bars"],
  ["fire", "Faster and smoother every time you open it"],
];

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[12px] font-extrabold text-brand-fg">{n}</span>
      <span className="text-[14px] leading-[1.4] text-white/80">{children}</span>
    </li>
  );
}
const Share = <Icon name="share" className="mx-0.5 size-[18px] translate-y-[3px] text-brand" />;
const Dots = <Icon name="menuDots" className="mx-0.5 size-[18px] translate-y-[3px] text-brand" />;
const B = ({ children }: { children: ReactNode }) => <b className="text-fg">{children}</b>;

function steps(i: InstallInfo): ReactNode[] {
  if (i.mode === "ios")
    return [
      <>Tap the Share button {Share} {i.safari ? (i.ipad ? "at the top right of Safari" : "at the bottom of Safari") : "in your browser's address bar or menu"}</>,
      <>Scroll down and tap <B>Add to Home Screen</B></>,
      <>Tap <B>Add</B>, then open Anaija from your Home Screen</>,
    ];
  if (i.mode === "inapp" && i.ios)
    return [
      <>Tap the {Dots} menu or the compass icon in the corner</>,
      <>Choose <B>Open in Safari</B></>,
      <>There, tap Share {Share} then <B>Add to Home Screen</B></>,
    ];
  if (i.mode === "manual") {
    if (i.android)
      return [
        i.samsung ? <>Tap the menu button (☰)</> : <>Tap the {Dots} menu at the top right</>,
        i.samsung ? <>Choose <B>Add page to</B>, then <B>Home screen</B></> : <>Choose <B>Install app</B> or <B>Add to Home screen</B></>,
        <>Tap <B>Install</B> and open Anaija from your home screen</>,
      ];
    if (i.safari)
      return [<>Open the <B>File</B> menu in the menu bar</>, <>Choose <B>Add to Dock</B></>, <>Open Anaija from your Dock</>];
    return [
      <>Click the install icon at the right end of the address bar, or open the {Dots} menu</>,
      <>Choose <B>Install Anaija</B></>,
      <>Open Anaija from your apps</>,
    ];
  }
  return [];
}

function Bar({ info, busy, onInstall, onHow }: { info: InstallInfo; busy: boolean; onInstall: () => void; onHow: () => void }) {
  const m = info.mode;
  const sub =
    m === "native" ? "Faster, full screen, with notifications"
    : m === "has-app" ? "Anaija is installed here. Open it from your home screen or app list for the full experience."
    : m === "inapp" ? "Open this page in your browser to install"
    : m === "unsupported" ? "Use Chrome, Edge or Safari to install"
    : "Add it to your device in a few taps";
  const label = m === "native" ? "Install" : m === "inapp" ? "Open browser" : "How";
  return (
    <div
      role="region"
      aria-label="Install Anaija"
      className="fixed inset-x-3 z-[55] mx-auto flex max-w-[440px] items-center gap-3 rounded-[22px] bg-surface-interactive p-3 shadow-[0_8px_28px_rgba(0,0,0,0.5)] ring-1 ring-white/8 md:inset-x-auto md:right-6 md:mx-0 md:w-[420px]"
      style={{ bottom: "calc(var(--nav-h, 0px) + env(safe-area-inset-bottom) + 10px)" }}
    >
      <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-fg">{m === "has-app" ? "Get the app experience" : "Install the Anaija app"}</p>
        <p className="text-[12px] leading-[1.35] text-muted">{sub}</p>
      </div>
      {m !== "has-app" && (
        <button type="button" disabled={busy} onClick={m === "native" ? onInstall : onHow} className="h-9 shrink-0 rounded-full bg-brand px-4 text-[13px] font-extrabold text-brand-fg transition active:scale-95 disabled:opacity-60">
          {label}
        </button>
      )}
    </div>
  );
}

function Sheet({ info, busy, onInstall, onLater }: { info: InstallInfo; busy: boolean; onInstall: () => void; onLater: () => void }) {
  const [copied, setCopied] = useState(false);
  const m = info.mode;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onLater]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {}
  }
  function openChrome() {
    const { host, pathname, search } = window.location;
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  const title =
    m === "native" ? "Install Anaija"
    : m === "inapp" ? "Open Anaija in your browser"
    : m === "unsupported" ? "Install from another browser"
    : "Add Anaija to your device";
  const sub =
    m === "native" ? "Get the full app: faster, full screen and with notifications."
    : m === "inapp" ? "This in-app browser can't install apps. Open the page in a real browser first."
    : m === "unsupported" ? "This browser can't install apps. Chrome, Edge and Safari can."
    : "It takes about ten seconds, and you won't need the browser again.";
  const list = steps(info);
  const arrow = m === "ios" && info.safari && !info.ipad;

  return (
    <div data-install-sheet role="dialog" aria-modal="true" aria-label="Install Anaija" className="fixed inset-0 z-[85] flex items-end justify-center md:items-center">
      <button type="button" aria-label="Not now" onClick={onLater} className="absolute inset-0 cursor-default bg-black/70" />
      <div className="relative w-full max-w-[440px] rounded-t-[30px] bg-surface-subtle px-5 pt-6 md:rounded-[30px]" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
        <img src="/icons/icon-192.png" alt="" className="mx-auto size-16 rounded-[18px]" />
        <h2 className="mt-4 text-center text-[20px] font-extrabold tracking-tight text-fg">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[320px] text-center text-[14px] leading-[1.4] text-white/65">{sub}</p>

        {m === "native" && (
          <ul className="mt-5 flex flex-col gap-3 rounded-2xl bg-surface-interactive p-4">
            {BENEFITS.map(([ic, t]) => (
              <li key={t} className="flex items-center gap-3 text-[13.5px] text-white/85">
                <Icon name={ic} filled className="size-5 shrink-0 text-brand" />
                {t}
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <ol className="mt-5 flex flex-col gap-3 rounded-2xl bg-surface-interactive p-4">
            {list.map((s, i) => (
              <Step key={i} n={i + 1}>{s}</Step>
            ))}
          </ol>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {m === "native" && (
            <>
              <button type="button" autoFocus disabled={busy} onClick={onInstall} className={PRIMARY}>{busy ? "Installing…" : "Install app"}</button>
              <button type="button" onClick={onLater} className={GHOST}>Not now</button>
            </>
          )}
          {(m === "ios" || m === "manual") && (
            <button type="button" autoFocus onClick={onLater} className={PRIMARY}>Got it</button>
          )}
          {(m === "inapp" || m === "unsupported") && (
            <>
              {m === "inapp" && info.android && <button type="button" autoFocus onClick={openChrome} className={PRIMARY}>Open in Chrome</button>}
              <button type="button" onClick={() => void copy()} className={m === "inapp" && info.android ? GHOST : PRIMARY}>{copied ? "Link copied" : "Copy link"}</button>
              <button type="button" onClick={onLater} className={GHOST}>Not now</button>
            </>
          )}
        </div>
        {arrow && (
          <div className="mt-3 grid place-items-center text-brand motion-safe:animate-bounce" aria-hidden="true">
            <Icon name="arrowDown" filled className="size-7" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Browser tabs only. The bar is always there; the sheet comes back after every page load and every "Not now". */
export function InstallNudge() {
  const info = useInstall();
  const pathname = usePathname() ?? "";
  const [sheet, setSheet] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  const nextAt = useRef(0);

  const m = info.mode;
  const actionable = m === "native" || m === "ios" || m === "inapp" || m === "manual" || m === "unsupported";
  const barOk = (actionable || m === "has-app") && !NO_BAR.some((r) => r.test(pathname));
  const sheetOk = actionable && !NO_SHEET.some((r) => r.test(pathname));

  useEffect(() => {
    nextAt.current = Date.now() + FIRST_MS;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const modal = !!document.querySelector('[aria-modal="true"]:not([data-install-sheet])');
      setBlocked(modal);
      if (!sheet && sheetOk && !modal && document.visibilityState === "visible" && Date.now() >= nextAt.current) setSheet(true);
    }, 1500);
    return () => window.clearInterval(id);
  }, [sheet, sheetOk]);

  useEffect(() => {
    let t: number | undefined;
    const on = () => {
      setSheet(false);
      setToast(true);
      t = window.setTimeout(() => setToast(false), 4500);
    };
    window.addEventListener("appinstalled", on);
    return () => {
      window.removeEventListener("appinstalled", on);
      window.clearTimeout(t);
    };
  }, []);

  const later = useCallback(() => {
    setSheet(false);
    nextAt.current = Date.now() + REPEAT_MS;
  }, []);

  async function install() {
    if (busy) return;
    setBusy(true);
    const r = await promptInstall();
    setBusy(false);
    if (r === "dismissed") later();
  }

  const showSheet = sheet && sheetOk;
  const showBar = barOk && !blocked && !showSheet;
  return (
    <>
      {showBar && <Bar info={info} busy={busy} onInstall={() => void install()} onHow={() => setSheet(true)} />}
      {showSheet && <Sheet info={info} busy={busy} onInstall={() => void install()} onLater={later} />}
      {toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4" style={{ bottom: "calc(28px + env(safe-area-inset-bottom))" }}>
          <span className="max-w-[88vw] rounded-full bg-white px-4 py-2 text-secondary font-semibold text-black shadow-lg">Anaija is installed. Open it from your home screen.</span>
        </div>
      )}
    </>
  );
}
