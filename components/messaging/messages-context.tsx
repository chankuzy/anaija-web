"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { messagingApi, type Conversation } from "@/lib/api/messaging";
import { storiesApi, type StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { useInterval } from "@/lib/messaging/use-interval";

type Ctx = {
  conversations: Conversation[] | null;
  inboxError: string | null;
  reloadInbox: () => void;
  patchConversation: (id: number, p: Partial<Conversation>) => void;
  upsertLast: (id: number, body: string) => void;
  groups: StoryGroup[];
  markStoriesSeen: (ids: number[]) => void;
  ringFor: (userId: number | undefined) => boolean;
};

const MessagesCtx = createContext<Ctx | null>(null);

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const at = (c: Conversation) => Date.parse(c.last_message_at ?? "") || 0;
const byRecent = (a: Conversation, b: Conversation) => at(b) - at(a);

// Inbox + stories live above the list AND the thread so both panes (and the ring on every avatar) agree.
export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const enabled = status === "authed";
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [groups, setGroups] = useState<StoryGroup[]>([]);

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
  useInterval(reloadInbox, 15_000, enabled);
  useInterval(loadStories, 30_000, enabled);

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
    () => ({ conversations: convs, inboxError, reloadInbox, patchConversation, upsertLast, groups, markStoriesSeen, ringFor }),
    [convs, inboxError, reloadInbox, patchConversation, upsertLast, groups, markStoriesSeen, ringFor],
  );
  return <MessagesCtx.Provider value={value}>{children}</MessagesCtx.Provider>;
}

export function useMessages(): Ctx {
  const v = useContext(MessagesCtx);
  if (!v) throw new Error("useMessages must be used inside <MessagesProvider>");
  return v;
}
