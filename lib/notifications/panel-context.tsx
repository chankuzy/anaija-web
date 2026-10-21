"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

type Ctx = { open: boolean; show: () => void; hide: () => void; toggle: () => void };

const PanelCtx = createContext<Ctx>({ open: false, show: () => {}, hide: () => {}, toggle: () => {} });

// No pathname here (it would block prerendering outside Suspense): AppShell closes the panel on route change.
export function NotificationsPanelProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [flag, setFlag] = useState(false);
  const open = flag && status === "authed";

  const show = useCallback(() => setFlag(true), []);
  const hide = useCallback(() => setFlag(false), []);
  const toggle = useCallback(() => setFlag((f) => !f), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFlag(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Page-level scroll hijackers must not see wheel/touch gestures made inside the panel's list.
  useEffect(() => {
    if (!open) return;
    const isolate = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-notif-scroll]")) e.stopPropagation();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("wheel", isolate, opts);
    window.addEventListener("touchmove", isolate, opts);
    return () => {
      window.removeEventListener("wheel", isolate, opts);
      window.removeEventListener("touchmove", isolate, opts);
    };
  }, [open]);

  // There is no /notifications page any more: any plain link to it (e.g. the mobile bell) opens the panel.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href="/notifications"]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      if (status === "authed") show();
      else router.push("/login");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [status, show, router]);

  const value = useMemo(() => ({ open, show, hide, toggle }), [open, show, hide, toggle]);
  return <PanelCtx.Provider value={value}>{children}</PanelCtx.Provider>;
}

export const useNotificationsPanel = () => useContext(PanelCtx);
