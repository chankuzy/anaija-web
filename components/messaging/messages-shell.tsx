"use client";
import { loginHref } from "@/lib/auth/next";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { InboxPane } from "./inbox-pane";

// Instagram layout: list on the left, thread on the right (md+). On phones it is one or the other:
// /messages shows the list, /messages/<id> shows the thread. The provider lives at the app root so the inbox
// is already loaded (and stays live) when you get here.
export function MessagesShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "guest") router.replace(loginHref());
  }, [status, router]);

  const open = /^\/messages\/\d+/.test(pathname);
  const activeId = open ? Number(pathname.split("/")[2]) : null;

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-bottom))] w-full overflow-hidden">
      <section className={`${open ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col border-white/5 md:w-[380px] md:shrink-0 md:border-r`}>
        <InboxPane activeId={activeId} />
      </section>
      <section className={`${open ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}>{children}</section>
    </div>
  );
}
