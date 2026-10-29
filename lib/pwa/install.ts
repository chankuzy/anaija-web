"use client";

import { useSyncExternalStore } from "react";

export interface BipEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
declare global {
  interface Window {
    __anaijaBip?: BipEvent | null;
  }
}

/**
 * wait         still working out what this browser can do (no UI)
 * app          already running as the installed app (no UI)
 * native       one tap installs (Chrome, Edge, Samsung, Opera on Android and desktop)
 * ios          Share -> Add to Home Screen
 * inapp        Instagram/Facebook/TikTok/etc: cannot install, must open a real browser first
 * manual       a browser that can install but gave us no one-tap prompt
 * unsupported  a browser that cannot install at all (desktop Firefox)
 * has-app      installed on this device already, but this is a browser tab
 */
export type InstallMode = "wait" | "app" | "native" | "ios" | "inapp" | "manual" | "unsupported" | "has-app";
export interface InstallInfo {
  mode: InstallMode;
  ios: boolean;
  ipad: boolean;
  android: boolean;
  safari: boolean;
  samsung: boolean;
  desktop: boolean;
}

const FLAG = "anaija:installed";
const SERVER: InstallInfo = { mode: "wait", ios: false, ipad: false, android: false, safari: false, samsung: false, desktop: true };

let started = false;
let settled = false;
let event: BipEvent | null = null;
let snap: InstallInfo = SERVER;
const subs = new Set<() => void>();

function platform() {
  const u = navigator.userAgent;
  const touchMac = /Macintosh/.test(u) && navigator.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(u) || touchMac;
  const ipad = /iPad/.test(u) || touchMac;
  const android = /Android/.test(u);
  const firefox = /Firefox|FxiOS/.test(u);
  const chromium = /Chrome|CriOS|Chromium|Edg|OPR|SamsungBrowser/.test(u);
  const safari = /Safari\//.test(u) && !chromium && !firefox;
  const desktop = !ios && !android;
  const inapp =
    /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|LinkedInApp|Pinterest|MicroMessenger|GSA\/|\bwv\b/.test(u) ||
    (ios && !/Safari\//.test(u));
  return { ios, ipad, android, safari, desktop, inapp, samsung: /SamsungBrowser/.test(u), unsupported: desktop && firefox };
}

function isStandalone() {
  const mq = (q: string) => window.matchMedia(`(display-mode: ${q})`).matches;
  return (
    mq("standalone") ||
    mq("fullscreen") ||
    mq("minimal-ui") ||
    mq("window-controls-overlay") ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

const hasFlag = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

function compute(): InstallInfo {
  const p = platform();
  let mode: InstallMode;
  if (isStandalone()) mode = "app";
  else if (p.inapp) mode = "inapp";
  else if (event) mode = "native";
  else if (hasFlag()) mode = "has-app";
  else if (p.ios) mode = "ios";
  else if (!settled) mode = "wait";
  else if (p.unsupported) mode = "unsupported";
  else mode = "manual";
  return { mode, ios: p.ios, ipad: p.ipad, android: p.android, safari: p.safari, samsung: p.samsung, desktop: p.desktop };
}

function emit() {
  const next = compute();
  if (JSON.stringify(next) === JSON.stringify(snap)) return;
  snap = next;
  subs.forEach((f) => f());
}

function ensure() {
  if (started || typeof window === "undefined") return;
  started = true;
  event = window.__anaijaBip ?? null;
  snap = compute();

  const onBip = (e: Event) => {
    e.preventDefault();
    window.__anaijaBip = e as BipEvent;
    event = e as BipEvent;
    // The browser offering an install means the app is NOT installed (any more).
    try {
      localStorage.removeItem(FLAG);
    } catch {}
    emit();
  };
  window.addEventListener("beforeinstallprompt", onBip);
  window.addEventListener("anaija:bip", () => {
    event = window.__anaijaBip ?? null;
    if (event) {
      try {
        localStorage.removeItem(FLAG);
      } catch {}
    }
    emit();
  });
  window.addEventListener("appinstalled", () => {
    event = null;
    window.__anaijaBip = null;
    try {
      localStorage.setItem(FLAG, "1");
    } catch {}
    emit();
  });
  for (const q of ["standalone", "fullscreen", "minimal-ui"]) window.matchMedia(`(display-mode: ${q})`).addEventListener("change", emit);
  document.addEventListener("visibilitychange", emit);
  // Chromium sends its install event a moment after load; until then do not tell people to use the menu.
  window.setTimeout(() => {
    settled = true;
    emit();
  }, 4500);
}

function subscribe(cb: () => void) {
  ensure();
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
const getSnap = () => {
  ensure();
  return snap;
};

export const useInstall = (): InstallInfo => useSyncExternalStore(subscribe, getSnap, () => SERVER);

/** Opens the browser's own install dialog. The event is single-use, so it is dropped once the person has answered. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = event;
  if (!e) return "unavailable";
  let outcome: "accepted" | "dismissed" = "dismissed";
  try {
    await e.prompt();
    outcome = (await e.userChoice).outcome;
  } catch {}
  event = null;
  window.__anaijaBip = null;
  if (outcome === "accepted") {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {}
  }
  emit();
  return outcome;
}
