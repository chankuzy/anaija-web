"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useActivity } from "@/lib/activity/activity-context";

// Mobile only: the rail already carries notifications and sign-in on larger screens. Scrolls away with the page.
export function HomeHeader({ authed }: { authed: boolean }) {
  const { unseen } = useActivity();
  return (
    <header className="px-4 md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-12 items-center justify-end">
        {authed ? (
          <Link href="/notifications" aria-label={unseen > 0 ? `${unseen} new notifications` : "Notifications"} className="relative -mr-2 grid size-11 place-items-center text-fg">
            <Icon name="bell" filled={unseen > 0} className="size-[26px]" />
            {unseen > 0 && (
              <span className="absolute right-0.5 top-0.5">
                <UnreadBadge count={unseen} label="new notifications" />
              </span>
            )}
          </Link>
        ) : (
          <Link href="/login" className="inline-flex h-9 items-center rounded-pill bg-brand px-4 text-secondary font-extrabold text-brand-fg">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
