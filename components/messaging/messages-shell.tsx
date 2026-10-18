"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { InboxProvider } from "@/lib/messaging/inbox-context";
import { InboxPanel } from "./inbox-panel";

// Two panes on tablet/desktop (list + thread); one at a time on phones. The inbox lives here so it
// survives navigating between threads.
export function MessagesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();
  const inThread = pathname !== "/messages";

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  return (
    <InboxProvider>
      <div className="flex" style={{ height: "calc(100dvh - var(--nav-h) - env(safe-area-inset-bottom))" }}>
        <aside className={`${inThread ? "hidden md:flex" : "flex"} w-full min-w-0 flex-col md:w-[360px] md:shrink-0 md:border-r md:border-line`}>
          <InboxPanel />
        </aside>
        <section className={`${inThread ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>{children}</section>
      </div>
    </InboxProvider>
  );
}
