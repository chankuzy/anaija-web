"use client";

import Link from "next/link";
import { AppLogo } from "@/components/ui/app-logo";
import { Icon } from "@/components/ui/icon";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useActivity } from "@/lib/activity/activity-context";
import { useMessagesUnread } from "@/lib/messaging/unread-context";

const BTN =
  "relative grid size-11 place-items-center text-fg transition-transform active:scale-95 motion-reduce:active:scale-100";

// Mobile only: the rail already carries notifications, messages and sign-in on larger screens. Scrolls away with the page.
// Both badges are real backend state (activity "unseen" and conversations with something unread).
export function HomeHeader({ authed }: { authed: boolean }) {
  const { unseen } = useActivity();
  const { count: chats } = useMessagesUnread();
  return (
    <header className="px-4 md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-12 items-center justify-between">
        <Link href="/" aria-label="Anaija home" className="inline-flex items-center">
          <AppLogo size={42} showMark={false} />
        </Link>
        {authed ? (
          <div className="-mr-2 flex items-center">
            <Link href="/notifications" aria-label={unseen > 0 ? `${unseen} new notifications` : "Notifications"} className={BTN}>
              <Icon name="bell" filled={unseen > 0} className="size-[26px]" />
              {unseen > 0 && (
                <span className="absolute right-0.5 top-0.5">
                  <UnreadBadge count={unseen} label="new notifications" />
                </span>
              )}
            </Link>
            <Link href="/messages" aria-label={chats > 0 ? `${chats} unread chats` : "Messages"} className={BTN}>
              <Icon name="message" filled={chats > 0} className="size-[26px]" />
              {chats > 0 && (
                <span className="absolute right-0.5 top-0.5">
                  <UnreadBadge count={chats} label="unread chats" />
                </span>
              )}
            </Link>
          </div>
        ) : (
          <Link href="/login" className="inline-flex h-9 items-center rounded-pill bg-brand px-4 text-secondary font-extrabold text-brand-fg">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
