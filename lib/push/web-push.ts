"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";

export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

const TOKEN_KEY = "anaija:push-token";
const SYNC_KEY = "anaija:push-synced-at";
const OPTOUT_KEY = "anaija:push-optout";
const PUSH_UID_KEY = "anaija:push-uid"; // which account this device\'s token belongs to
const DAY = 86_400_000;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };
const drop = (k: string) => { try { localStorage.removeItem(k); } catch {} };

function pushSupport(): "ok" | "unsupported" | "needs-install" {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

export function readPushState(): PushState {
  const s = pushSupport();
  if (s !== "ok") return s;
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" && !read(OPTOUT_KEY) && read(TOKEN_KEY) ? "on" : "off";
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os} (web)`;
}

async function fcmToken(): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) throw new Error("Push isn't configured yet.");

  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg?.active) throw new Error("Push needs the production build (service worker isn't active).");

  const [{ getApp, getApps, initializeApp }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) throw new Error("This browser can't receive push notifications.");
  const app = getApps().length ? getApp() : initializeApp({ apiKey, projectId, messagingSenderId, appId });
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Couldn't get a push token.");
  return token;
}

async function register(token: string, uid?: string) {
  await api.post("devices-register", { push_token: token, push_platform: "web", device_name: deviceName() });
  write(TOKEN_KEY, token);
  write(SYNC_KEY, String(Date.now()));
  write(PUSH_UID_KEY, uid ?? read("anaija:uid") ?? "");
}

export async function enablePush(): Promise<PushState> {
  if (pushSupport() !== "ok") return readPushState();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return readPushState();
  await register(await fcmToken());
  drop(OPTOUT_KEY);
  return "on";
}

export async function disablePush(optOut = true): Promise<void> {
  const token = read(TOKEN_KEY);
  if (token) {
    try { await api.delete("devices-unregister", { push_token: token }); } catch {}
  }
  try {
    const [{ getApp, getApps }, { getMessaging, deleteToken, isSupported }] = await Promise.all([
      import("firebase/app"),
      import("firebase/messaging"),
    ]);
    if (getApps().length && (await isSupported())) await deleteToken(getMessaging(getApp()));
  } catch {}
  drop(TOKEN_KEY);
  drop(SYNC_KEY);
  if (optOut) write(OPTOUT_KEY, "1");
}

export async function syncPush(uid: string): Promise<void> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted" || read(OPTOUT_KEY)) return;
  const fresh = read(TOKEN_KEY) && read(PUSH_UID_KEY) === uid && Date.now() - Number(read(SYNC_KEY) || 0) < DAY;
  if (fresh) return;
  try {
    await register(await fcmToken(), uid);
  } catch {}
}

const noSub = () => () => {};

export function usePush() {
  const [override, setState] = useState<PushState | null>(null);
  const live = useSyncExternalStore(noSub, readPushState, () => null);
  const state: PushState | null = override ?? live;
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async (on: boolean) => {
    setBusy(true);
    try {
      if (on) setState(await enablePush());
      else { await disablePush(true); setState(readPushState()); }
    } finally { setBusy(false); }
  }, []);

  return { state, busy, toggle };
}
