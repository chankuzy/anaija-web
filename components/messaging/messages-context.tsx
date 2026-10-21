"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { messagingApi, type Conversation } from "@/lib/api/messaging";
import { storiesApi, type StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { useInterval } from "@/lib/messaging/use-interval";
import { subscribeBroadcast } from "@/lib/realtime/client";

type Ctx = {
  conversations: Conversation[] | null;
  inboxError: string | null;
  reloadInbox: () => void;
  patchConversation: (id: number, p: Partial<Conversation>) => void;
  upsertLast: (id: number, body: string) => void;
  groups: StoryGroup[];
  markStoriesSeen: (ids: number[]) => void;
  ringFor: (userId: number | undefined) => boolean;
  live: boolean; // user:{id} channel joined
  pulse: { id: number; n: number }; // bumps when the server says conversation `id` changed
};

const MessagesCtx = createContext<Ctx | null>(null);

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const at = (c: Conversation) => Date.parse(c.last_message_at ?? "") || 0;
const byRecent = (a: Conversation, b: Conversation) => at(b) - at(a);

type InboxUpdate = { conversation_id?: number; last_message_body?: string; last_message_at?: string; unread_count?: number };

// Inbox + stories live above the list AND the thread so both panes (and the ring on every avatar) agree.
export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const enabled = status === "authed";
  const uid = enabled ? (user?.id ?? null) : null;
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [live, setLive] = useState(false);
  const [storiesLive, setStoriesLive] = useState(false);
  const [pulse, setPulse] = useState({ id: 0, n: 0 });
  const convsRef = useRef<Conversation[] | null>(null);
  const activeRef = useRef<number | null>(null);

  const m = /^\/messages\/(\d+)/.exec(pathname);
  const activeId = m ? Number(m[1]) : null;
  useEffect(() => {
    activeRef.current = activeId;
    convsRef.current = convs;
  });

  const reloadInbox = useCallback(() => {
    messagingApi
      .inbox()
      .then((l) => {
        setConvs([...l].sort(byRecent));
        setInboxError(null);
      })
      .catch((e: unknown) => setInboxError(messageOf(e)));
  }, []);
  const loadStories = useCallback(() => {
    storiesApi.list().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reloadInbox();
    loadStories();
  }, [enabled, reloadInbox, loadStories]);

  // user:{id} -> inbox_update. Polling stays as a slow safety net (broadcast has no backlog).
  useEffect(() => {
    if (uid === null) return;
    const off = subscribeBroadcast(
      `user:${uid}`,
      {
        inbox_update: (p) => {
          const u = p as InboxUpdate;
          const id = u.conversation_id;
          if (!id) return;
          setPulse((prev) => ({ id, n: prev.n + 1 }));
          if (!convsRef.current?.some((c) => c.id === id)) {
            reloadInbox();
            return;
          }
          setConvs((prev) =>
            prev
              ? prev
                  .map((c) =>
                    c.id === id
                      ? {
                          ...c,
                          last_message_body: u.last_message_body ?? c.last_message_body,
                          last_message_at: u.last_message_at ?? c.last_message_at,
                          unread_count: activeRef.current === id ? 0 : (u.unread_count ?? c.unread_count),
                        }
                      : c,
                  )
                  .sort(byRecent)
              : prev,
          );
        },
      },
      setLive,
    );
    return () => {
      off();
      setLive(false);
    };
  }, [uid, reloadInbox]);

  // stories:{myId} -> stories_update (someone I follow posted/changed a story). Re-read the tray.
  useEffect(() => {
    if (uid === null) return;
    let t: number | undefined;
    const off = subscribeBroadcast(
      `stories:${uid}`,
      {
        stories_update: () => {
          window.clearTimeout(t);
          t = window.setTimeout(loadStories, 300);
        },
      },
      setStoriesLive,
    );
    return () => {
      window.clearTimeout(t);
      off();
      setStoriesLive(false);
    };
  }, [uid, loadStories]);

  useInterval(reloadInbox, live ? 60_000 : 15_000, enabled);
  useInterval(loadStories, storiesLive ? 120_000 : 30_000, enabled);

  const patchConversation = useCallback(
    (id: number, p: Partial<Conversation>) =>
      setConvs((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, ...p } : c)) : prev)),
    [],
  );
  const upsertLast = useCallback(
    (id: number, body: string) =>
      setConvs((prev) =>
        prev
          ? prev
              .map((c) =>
                c.id === id
                  ? { ...c, last_message_body: body, last_message_at: new Date().toISOString(), unread_count: 0 }
                  : c,
              )
              .sort(byRecent)
          : prev,
      ),
    [],
  );
  const markStoriesSeen = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      setGroups((prev) =>
        prev.map((g) => {
          const stories = g.stories.map((s) => (ids.includes(s.id) ? { ...s, seen: true } : s));
          return { ...g, stories, has_unseen: stories.some((s) => !s.seen) };
        }),
      );
    },
    [],
  );
  const ringFor = useCallback(
    (userId: number | undefined) => userId !== undefined && groups.some((g) => g.author.id === userId && g.has_unseen),
    [groups],
  );

  const value = useMemo<Ctx>(
    () => ({ conversations: convs, inboxError, reloadInbox, patchConversation, upsertLast, groups, markStoriesSeen, ringFor, live, pulse }),
    [convs, inboxError, reloadInbox, patchConversation, upsertLast, groups, markStoriesSeen, ringFor, live, pulse],
  );
  return <MessagesCtx.Provider value={value}>{children}</MessagesCtx.Provider>;
}

export function useMessages(): Ctx {
  const v = useContext(MessagesCtx);
  if (!v) throw new Error("useMessages must be used inside <MessagesProvider>");
  return v;
}
