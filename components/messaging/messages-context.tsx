"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { isPending, messagingApi, type Conversation } from "@/lib/api/messaging";
import { storiesApi, type StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { onCacheClear, peek, put, useCacheReady } from "@/lib/cache/swr";
import { useInterval } from "@/lib/messaging/use-interval";
import { subscribeBroadcast } from "@/lib/realtime/client";
import { startPresence } from "@/lib/realtime/presence";
import { uploadManager } from "@/lib/create/upload-manager";

type Ctx = {
  conversations: Conversation[] | null;
  inboxError: string | null;
  reloadInbox: () => void;
  reloadStories: () => void;
  patchConversation: (id: number, p: Partial<Conversation>) => void;
  upsertLast: (id: number, body: string) => void;
  groups: StoryGroup[];
  markStoriesSeen: (ids: number[]) => void;
  ringFor: (userId: number | undefined) => boolean;
  live: boolean; // user:{id} channel joined
  unreadChats: number; // conversations with something unread (muted excluded, each request counts once)
  pulse: { id: number; n: number }; // bumps when the server says conversation `id` changed
};

export const MessagesCtx = createContext<Ctx | null>(null);

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const at = (c: Conversation) => Date.parse(c.last_message_at ?? "") || 0;
const byRecent = (a: Conversation, b: Conversation) => at(b) - at(a);
// Your own story is never "unwatched" to you: it shows faded and opens from its first story.
const asOwn = (me: number) => (g: StoryGroup): StoryGroup =>
  g.author.id === me ? { ...g, has_unseen: false, stories: g.stories.map((s) => (s.seen ? s : { ...s, seen: true })) } : g;

type InboxUpdate = { conversation_id?: number; last_message_body?: string; last_message_at?: string; last_message_by?: number; unread_count?: number };

// Memory only (chat previews are never written to disk), keyed by account so a switch can never leak.
type Store = { uid: number | null; convs: Conversation[] | null; groups: StoryGroup[]; error: string | null };
const EMPTY: Store = { uid: null, convs: null, groups: [], error: null };
const base = (s: Store, u: number): Store => (s.uid === u ? s : { uid: u, convs: null, groups: [], error: null });

const REFRESH_ON_ENTER_MS = 20_000;

// Mounted once at the app root: the inbox and the story ring state load in the background as soon as you are
// signed in, stay live over realtime, and are simply there when you open Messages. Entering /messages only
// reconciles quietly if the data has gone stale.
export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const uid = status === "authed" ? (user?.id ?? null) : null;
  const inMessages = pathname === "/messages" || pathname.startsWith("/messages/");
  const [store, setStore] = useState<Store>(EMPTY);
  const [live, setLive] = useState(false);
  const [storiesLive, setStoriesLive] = useState(false);
  const [pulse, setPulse] = useState({ id: 0, n: 0 });
  const uidRef = useRef<number | null>(null);
  const convsRef = useRef<Conversation[] | null>(null);
  const activeRef = useRef<number | null>(null);
  const lastInbox = useRef(0);
  const lastStories = useRef(0);

  // Last-seen inbox comes from disk the moment the cache is warm; the network only reconciles it.
  const cacheReady = useCacheReady();
  const warm = uid !== null && cacheReady ? peek<Conversation[]>(`convs:${uid}`) : undefined;
  // Adopt the saved inbox whenever there is nothing on screen yet, even after a failed (offline) fetch.
  if (warm && uid !== null && warm.data.length > 0 && (store.uid !== uid || !store.convs)) {
    setStore((s) => ({ uid, convs: [...warm.data].sort(byRecent), groups: s.uid === uid ? s.groups : [], error: null }));
  }

  const mine = uid !== null && store.uid === uid ? store : EMPTY;
  const m = /^\/messages\/(\d+)/.exec(pathname);
  const activeId = m ? Number(m[1]) : null;
  useEffect(() => {
    uidRef.current = uid;
    activeRef.current = activeId;
    convsRef.current = mine.convs;
  });

  useEffect(
    () =>
      onCacheClear(() => {
        setStore(EMPTY);
        lastInbox.current = 0;
        lastStories.current = 0;
      }),
    [],
  );

  useEffect(() => {
    if (store.uid !== null && store.convs) put(`convs:${store.uid}`, store.convs);
  }, [store.uid, store.convs]);

  const reloadInbox = useCallback(() => {
    const u = uidRef.current;
    if (u === null) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStore((s) => {
        const b = base(s, u);
        return b.convs ? b : { ...b, error: "You're offline. Your chats will show here when you're back online." };
      });
      return;
    }
    messagingApi
      .inbox()
      .then((l) => {
        if (uidRef.current !== u) return;
        lastInbox.current = Date.now();
        setStore((s) => ({ ...base(s, u), convs: [...l].sort(byRecent), error: null }));
      })
      .catch((e: unknown) => {
        if (uidRef.current !== u) return;
        setStore((s) => {
          const b = base(s, u);
          return b.convs ? b : { ...b, error: messageOf(e) };
        });
      });
  }, []);

  const loadStories = useCallback(() => {
    const u = uidRef.current;
    if (u === null) return;
    storiesApi
      .list()
      .then((g) => {
        if (uidRef.current !== u) return;
        lastStories.current = Date.now();
        setStore((s) => ({ ...base(s, u), groups: g.map(asOwn(u)) }));
      })
      .catch(() => {});
  }, []);

  // Background preload as soon as we know who is signed in.
  useEffect(() => {
    if (uid === null) return;
    reloadInbox();
    loadStories();
  }, [uid, reloadInbox, loadStories]);

  // Back online: reconcile quietly.
  useEffect(() => {
    if (uid === null) return;
    const on = () => {
      reloadInbox();
      loadStories();
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [uid, reloadInbox, loadStories]);

  // Tab comes back: broadcast has no backlog, so reconcile anything missed while hidden or offline.
  useEffect(() => {
    if (uid === null) return;
    const on = () => {
      if (document.visibilityState === "visible" && Date.now() - lastInbox.current > REFRESH_ON_ENTER_MS) reloadInbox();
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [uid, reloadInbox]);

  // Opening Messages: quiet reconcile only if stale.
  useEffect(() => {
    if (uid === null || !inMessages) return;
    if (Date.now() - lastInbox.current > REFRESH_ON_ENTER_MS) reloadInbox();
    if (Date.now() - lastStories.current > REFRESH_ON_ENTER_MS) loadStories();
  }, [uid, inMessages, reloadInbox, loadStories]);

  // user:{id} -> inbox_update, always on so the inbox is current even while you are elsewhere.
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
          setStore((s) =>
            s.uid === uid && s.convs
              ? {
                  ...s,
                  convs: s.convs
                    .map((c) =>
                      c.id === id
                        ? {
                            ...c,
                            last_message_body: u.last_message_body ?? c.last_message_body,
                            last_message_at: u.last_message_at ?? c.last_message_at,
                            last_message_by: u.last_message_by ?? c.last_message_by,
                            unread_count: activeRef.current === id ? 0 : (u.unread_count ?? c.unread_count),
                          }
                        : c,
                    )
                    .sort(byRecent),
                }
              : s,
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

  // Online presence: visible to everyone who is signed in.
  useEffect(() => {
    if (uid === null) return;
    return startPresence(uid);
  }, [uid]);

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

  // Publishing a story (or any post) refreshes the tray right away, and once more after the server has settled.
  useEffect(() => {
    if (uid === null) return;
    let t: number | undefined;
    const off = uploadManager.onPublished(() => {
      loadStories();
      window.clearTimeout(t);
      t = window.setTimeout(loadStories, 1500);
    });
    return () => {
      window.clearTimeout(t);
      off();
    };
  }, [uid, loadStories]);

  // Safety-net polling only while the Messages UI is on screen (broadcast has no backlog).
  const poll = uid !== null && inMessages;
  useInterval(reloadInbox, live ? 60_000 : 15_000, poll);
  // Stories also refresh on the feed (where the row lives), not only inside Messages.
  useInterval(loadStories, storiesLive ? 90_000 : 30_000, uid !== null);

  const patchConversation = useCallback(
    (id: number, p: Partial<Conversation>) =>
      setStore((s) =>
        s.uid === uidRef.current && s.convs ? { ...s, convs: s.convs.map((c) => (c.id === id ? { ...c, ...p } : c)) } : s,
      ),
    [],
  );
  const upsertLast = useCallback(
    (id: number, body: string) =>
      setStore((s) =>
        s.uid === uidRef.current && s.convs
          ? {
              ...s,
              convs: s.convs
                .map((c) =>
                  c.id === id ? { ...c, last_message_body: body, last_message_at: new Date().toISOString(), last_message_by: uidRef.current, unread_count: 0 } : c,
                )
                .sort(byRecent),
            }
          : s,
      ),
    [],
  );
  const markStoriesSeen = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    setStore((s) =>
      s.uid === uidRef.current
        ? {
            ...s,
            groups: s.groups.map((g) => {
              const stories = g.stories.map((x) => (ids.includes(x.id) ? { ...x, seen: true } : x));
              return { ...g, stories, has_unseen: stories.some((x) => !x.seen) };
            }),
          }
        : s,
    );
  }, []);

  const groups = mine.groups;
  const ringFor = useCallback(
    (userId: number | undefined) => userId !== undefined && groups.some((g) => g.author.id === userId && g.has_unseen),
    [groups],
  );

  const conversations = mine.convs;
  const unreadChats = useMemo(() => {
    let n = 0;
    for (const c of conversations ?? []) {
      if (isPending(c)) n += 1;
      else if (c.unread_count > 0 && !c.is_muted) n += 1;
    }
    return n;
  }, [conversations]);
  const inboxError = mine.error;
  const value = useMemo<Ctx>(
    () => ({ conversations, inboxError, reloadInbox, reloadStories: loadStories, patchConversation, upsertLast, groups, markStoriesSeen, ringFor, live, unreadChats, pulse }),
    [conversations, inboxError, reloadInbox, loadStories, patchConversation, upsertLast, groups, markStoriesSeen, ringFor, live, unreadChats, pulse],
  );
  return <MessagesCtx.Provider value={value}>{children}</MessagesCtx.Provider>;
}

export function useMessages(): Ctx {
  const v = useContext(MessagesCtx);
  if (!v) throw new Error("useMessages must be used inside <MessagesProvider>");
  return v;
}
