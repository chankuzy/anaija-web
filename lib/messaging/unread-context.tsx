"use client";

import { useContext, useMemo } from "react";
import { MessagesCtx } from "@/components/messaging/messages-context";

type Ctx = { count: number; refresh: () => void };
const NONE: Ctx = { count: 0, refresh: () => {} };

// The badge counts conversations with something unread (muted chats excluded; each message request counts once).
// It is derived from the inbox MessagesProvider already keeps live over realtime, so it no longer polls the
// inbox endpoint a second time. The provider stays as a pass-through so the app root needs no change.
export function MessagesUnreadProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useMessagesUnread(): Ctx {
  const m = useContext(MessagesCtx);
  const count = m?.unreadChats ?? 0;
  const refresh = m?.reloadInbox;
  return useMemo(() => (refresh ? { count, refresh } : NONE), [count, refresh]);
}
