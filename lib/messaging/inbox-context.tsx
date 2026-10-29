"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { asUtc, messagingApi, type Conversation } from "@/lib/api/messaging";
import { useAuth } from "@/lib/auth/auth-context";
import { peek, put, useCacheReady } from "@/lib/cache/swr";
import { subscribeBroadcast } from "@/lib/realtime/client";

interface State {
  userId: number | null;
  items: Conversation[];
  error: string | null;
}
interface Ctx {
  loading: boolean;
  items: Conversation[];
  error: string | null;
  reload: () => void;
  patch: (id: number, p: Partial<Conversation>) => void;
  remove: (id: number) => void;
  prepend: (c: Conversation) => void;
  setActive: (id: number | null) => void;
}

const ts = (c: Conversation) => Date.parse(asUtc(c.last_message_at ?? "1970-01-01T00:00:00Z"));
const sortConv = (l: Conversation[]) => [...l].sort((a, b) => ts(b) - ts(a));
const InboxCtx = createContext<Ctx | null>(null);
const inboxKey = (uid: number) => `inbox:${uid}`;

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const uid = status === "authed" ? (user?.id ?? null) : null;
  const [state, setState] = useState<State>(() => {
    const cached = uid === null ? undefined : peek<Conversation[]>(inboxKey(uid));
    return cached && uid !== null
      ? { userId: uid, items: sortConv(cached.data), error: null }
      : { userId: null, items: [], error: null };
  });
  const [nonce, setNonce] = useState(0);
  const cacheReady = useCacheReady();
  const itemsRef = useRef<Conversation[]>([]);
  const activeRef = useRef<number | null>(null);

  useEffect(() => {
    itemsRef.current = state.items;
  });

  // The warm-up can land after first render: adopt the last-seen inbox the moment it does.
  const warm = uid !== null && cacheReady ? peek<Conversation[]>(inboxKey(uid)) : undefined;
  if (warm && uid !== null && warm.data.length > 0 && (state.userId !== uid || (state.error && state.items.length === 0))) {
    setState({ userId: uid, items: sortConv(warm.data), error: null });
  }

  // Last-seen inbox survives cold starts (cleared with the rest of the cache on sign-out / account change).
  useEffect(() => {
    if (state.userId !== null && !state.error) put(inboxKey(state.userId), state.items);
  }, [state]);

  useEffect(() => {
    if (uid === null) return;
    const ac = new AbortController();
    messagingApi
      .inbox(ac.signal)
      .then((items) => !ac.signal.aborted && setState({ userId: uid, items: sortConv(items), error: null }))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setState((p) => (p.userId === uid ? p : { userId: uid, items: [], error: e instanceof ApiError ? e.message : "Something went wrong." }));
      });
    return () => ac.abort();
  }, [uid, nonce]);

  // Live: user:{id} carries inbox_update. A conversation we've never seen needs a real fetch.
  useEffect(() => {
    if (uid === null) return;
    return subscribeBroadcast(`user:${uid}`, {
      inbox_update: (p) => {
        const u = p as { conversation_id?: number; last_message_body?: string; last_message_at?: string; unread_count?: number };
        if (!u.conversation_id) return;
        if (!itemsRef.current.some((c) => c.id === u.conversation_id)) {
          setNonce((n) => n + 1);
          return;
        }
        setState((prev) => ({
          ...prev,
          items: sortConv(
            prev.items.map((c) =>
              c.id === u.conversation_id
                ? {
                    ...c,
                    last_message_body: u.last_message_body ?? c.last_message_body,
                    last_message_at: u.last_message_at ?? c.last_message_at,
                    unread_count: activeRef.current === c.id ? 0 : (u.unread_count ?? c.unread_count),
                  }
                : c,
            ),
          ),
        }));
      },
    });
  }, [uid]);

  // Safety net: broadcast has no backlog, so refetch on a slow poll and when the tab comes back.
  useEffect(() => {
    if (uid === null) return;
    const bump = () => document.visibilityState === "visible" && setNonce((n) => n + 1);
    const id = window.setInterval(bump, 30_000);
    document.addEventListener("visibilitychange", bump);
    window.addEventListener("online", bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", bump);
      window.removeEventListener("online", bump);
    };
  }, [uid]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const patch = useCallback(
    (id: number, p: Partial<Conversation>) =>
      setState((s) => ({ ...s, items: sortConv(s.items.map((c) => (c.id === id ? { ...c, ...p } : c))) })),
    [],
  );
  const remove = useCallback((id: number) => setState((s) => ({ ...s, items: s.items.filter((c) => c.id !== id) })), []);
  const prepend = useCallback(
    (c: Conversation) => setState((s) => (s.items.some((x) => x.id === c.id) ? s : { ...s, items: sortConv([c, ...s.items]) })),
    [],
  );
  const setActive = useCallback((id: number | null) => {
    activeRef.current = id;
  }, []);

  const loading = uid !== null && state.userId !== uid;
  const value = useMemo(
    () => ({ loading, items: state.userId === uid ? state.items : [], error: state.error, reload, patch, remove, prepend, setActive }),
    [loading, state, uid, reload, patch, remove, prepend, setActive],
  );
  return <InboxCtx.Provider value={value}>{children}</InboxCtx.Provider>;
}

export function useInbox(): Ctx {
  const v = useContext(InboxCtx);
  if (!v) throw new Error("useInbox must be used inside <InboxProvider>");
  return v;
}
