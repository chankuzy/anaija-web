"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ShareSheet } from "@/components/share/share-sheet";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";

// delta = optimistic change from a tap / rollback; serverCount = the real number once the server confirms.
type OnShared = (delta: number, serverCount?: number) => void;
type OpenShare = (post: Post, onShared?: OnShared) => void;

const ShareCtx = createContext<OpenShare>(() => {});

// One share sheet for the whole app: any screen calls `useShare()(post, onShared)`. The toast lives here, so a
// confirmation ("Added to your story") survives the sheet closing.
export function ShareProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const [active, setActive] = useState<{ post: Post; onShared?: OnShared } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const open = useCallback<OpenShare>(
    (post, onShared) => {
      if (status === "guest") {
        router.push("/login");
        return;
      }
      setActive({ post, onShared });
    },
    [status, router],
  );
  const close = useCallback(() => setActive(null), []);

  return (
    <ShareCtx.Provider value={open}>
      {children}
      {active && <ShareSheet key={active.post.id} post={active.post} onShared={active.onShared} onClose={close} flash={flash} />}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
          style={{ bottom: "calc(28px + env(safe-area-inset-bottom))" }}
        >
          <span className="max-w-[85vw] truncate rounded-full bg-white px-4 py-2 text-secondary font-semibold text-black shadow-lg">
            {toast.text}
          </span>
        </div>
      )}
    </ShareCtx.Provider>
  );
}

export const useShare = () => useContext(ShareCtx);
