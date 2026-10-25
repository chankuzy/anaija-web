"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GuestShareSheet } from "@/components/share/guest-share-sheet";
import { ShareSheet } from "@/components/share/share-sheet";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { holdMedia, releaseMedia } from "@/lib/feed/media-hold";

// delta = optimistic change from a tap / rollback; serverCount = the real number once the server confirms.
type OnShared = (delta: number, serverCount?: number) => void;
type OnReposted = (p: Partial<Post>) => void;
type OpenShare = (post: Post, onShared?: OnShared, onReposted?: OnReposted) => void;

const ShareCtx = createContext<OpenShare>(() => {});

// One share sheet for the whole app: any screen calls `useShare()(post, onShared)`. The toast lives here, so a
// confirmation ("Added to your story") survives the sheet closing. Signed-in people get the full sheet; everyone
// else gets the link-only one (sharing outward needs no account).
export function ShareProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [active, setActive] = useState<{ post: Post; onShared?: OnShared; onReposted?: OnReposted } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flash = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const open = useCallback<OpenShare>((post, onShared, onReposted) => setActive({ post, onShared, onReposted }), []);
  const close = useCallback(() => setActive(null), []);
  const sharing = active !== null;
  useEffect(() => {
    if (!sharing) return;
    holdMedia("share");
    return () => releaseMedia("share");
  }, [sharing]);

  return (
    <ShareCtx.Provider value={open}>
      {children}
      {active &&
        (status === "authed" ? (
          <ShareSheet key={active.post.id} post={active.post} onShared={active.onShared} onReposted={active.onReposted} onClose={close} flash={flash} />
        ) : (
          <GuestShareSheet key={active.post.id} post={active.post} onClose={close} flash={flash} />
        ))}
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
