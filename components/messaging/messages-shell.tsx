"use client";
import { loginHref } from "@/lib/auth/next";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useLockScroll, useViewport } from "@/lib/ui/use-visual-viewport";
import { InboxPane } from "./inbox-pane";

// Instagram layout: list on the left, thread on the right (md+). On phones it is one or the other:
// /messages shows the list, /messages/<id> shows the thread. The provider lives at the app root so the inbox
// is already loaded (and stays live) when you get here. With a thread open on a phone the shell becomes a
// full-screen frame that tracks the visual viewport, so thread, composer and keyboard move as one.
export function MessagesShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const vp = useViewport();

  useEffect(() => {
    if (status === "guest") router.replace(loginHref());
  }, [status, router]);

  const open = /^\/messages\/\d+/.test(pathname);
  const activeId = open ? Number(pathname.split("/")[2]) : null;
  useLockScroll(open);

  const vars = {
    "--vvh": vp ? `${vp.h}px` : "100dvh",
    "--vvt": vp ? `${vp.t}px` : "0px",
  } as React.CSSProperties;
  const tall = "h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-bottom))]";
  const frame = open
    ? `max-md:fixed max-md:inset-x-0 max-md:top-[var(--vvt)] max-md:z-[45] max-md:h-[var(--vvh)] max-md:bg-bg md:${tall}`
    : tall;

  return (
    <div className={`flex w-full overflow-hidden ${frame}`} style={vars}>
      <section className={`${open ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-[380px] md:shrink-0`}>
        <InboxPane activeId={activeId} />
      </section>
      <section className={`${open ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}>{children}</section>
    </div>
  );
}
