"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME } from "./default";

export type ThemePref = "light" | "dark" | "system";
const KEY = "anaija:theme";
const listeners = new Set<() => void>();

export function getPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const resolve = (p: ThemePref): "light" | "dark" =>
  p === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : p;

export function applyTheme(p: ThemePref) {
  const m = resolve(p);
  document.documentElement.setAttribute("data-theme", m);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m === "dark" ? "#09090b" : "#ffffff");
}

export function setPref(p: ThemePref) {
  try {
    localStorage.setItem(KEY, p);
  } catch {}
  applyTheme(p);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onMq = () => {
    if (getPref() === "system") applyTheme("system");
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      applyTheme(getPref());
      cb();
    }
  };
  mq.addEventListener("change", onMq);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onMq);
    window.removeEventListener("storage", onStorage);
  };
}

export const useThemePref = () => useSyncExternalStore(subscribe, getPref, (): ThemePref => DEFAULT_THEME);
