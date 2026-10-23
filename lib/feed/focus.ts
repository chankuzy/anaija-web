"use client";

import { useSyncExternalStore } from "react";

// One source of truth for "may media play right now": tab visible AND the window focused.
// Blur, tab switch, minimise, pagehide and bfcache freeze all flip it to false immediately.
type Listener = () => void;
const listeners = new Set<Listener>();
let current = false;
let attached = false;

const measure = () =>
  typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();

function set(next: boolean) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}
const recheck = () => set(measure());
const goFalse = () => set(false);

function attach() {
  current = measure();
  document.addEventListener("visibilitychange", recheck);
  document.addEventListener("freeze", goFalse);
  window.addEventListener("focus", recheck);
  window.addEventListener("blur", goFalse);
  window.addEventListener("pagehide", goFalse);
  window.addEventListener("pageshow", recheck);
  // Safety net: if a browser misreports hasFocus() on load, the first interaction corrects it.
  window.addEventListener("pointerdown", recheck, true);
  window.addEventListener("keydown", recheck, true);
  attached = true;
}

function detach() {
  document.removeEventListener("visibilitychange", recheck);
  document.removeEventListener("freeze", goFalse);
  window.removeEventListener("focus", recheck);
  window.removeEventListener("blur", goFalse);
  window.removeEventListener("pagehide", goFalse);
  window.removeEventListener("pageshow", recheck);
  window.removeEventListener("pointerdown", recheck, true);
  window.removeEventListener("keydown", recheck, true);
  attached = false;
}

export const isFocusedNow = () => (attached ? current : measure());

function subscribe(l: Listener) {
  listeners.add(l);
  if (!attached) attach();
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) detach();
  };
}

export function useDocumentFocus(): boolean {
  return useSyncExternalStore(subscribe, isFocusedNow, () => false);
}
