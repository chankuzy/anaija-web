"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { messagingApi, type Message } from "@/lib/api/messaging";
import { useInterval } from "./use-interval";

type TState = { id: number; items: Message[]; cursor: string | null; error: string | null; loadingOlder: boolean };

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const isLocal = (m: Message) => m.status !== undefined;

// Server window replaces what it covers; older pages already loaded and unconfirmed local sends are kept.
function mergeLatest(prev: TState | null, id: number, server: Message[], cursor: string | null): TState {
  const base = prev && prev.id === id ? prev : null;
  const ids = new Set(server.map((m) => m.id));
  const first = server[0]?.id ?? Number.POSITIVE_INFINITY;
  const older = base ? base.items.filter((m) => !isLocal(m) && !ids.has(m.id) && m.id < first) : [];
  const locals = base ? base.items.filter(isLocal) : [];
  return {
    id,
    items: [...older, ...server, ...locals],
    cursor: base && older.length ? base.cursor : cursor,
    error: null,
    loadingOlder: false,
  };
}

// Messages are polled (the browser has no realtime channel through the cookie proxy); sends are optimistic.
export function useThread(conversationId: number, myId: number | undefined) {
  const enabled = myId !== undefined;
  const [state, setState] = useState<TState | null>(null);
  const s = state && state.id === conversationId ? state : null;

  const fetchLatest = useCallback(() => {
    messagingApi
      .messages(conversationId)
      .then(({ items, nextCursor }) => setState((p) => mergeLatest(p, conversationId, items, nextCursor)))
      .catch((e: unknown) =>
        setState((p) =>
          p && p.id === conversationId
            ? { ...p, error: messageOf(e) }
            : { id: conversationId, items: [], cursor: null, error: messageOf(e), loadingOlder: false },
        ),
      );
  }, [conversationId]);

  useEffect(() => {
    if (!enabled) return;
    fetchLatest();
  }, [enabled, fetchLatest]);
  useInterval(fetchLatest, 6000, enabled);

  const loadOlder = useCallback(() => {
    if (!s?.cursor || s.loadingOlder) return;
    const cursor = s.cursor;
    setState((p) => (p && p.id === conversationId ? { ...p, loadingOlder: true } : p));
    messagingApi
      .messages(conversationId, cursor)
      .then(({ items, nextCursor }) =>
        setState((p) => {
          if (!p || p.id !== conversationId) return p;
          const have = new Set(p.items.map((m) => m.id));
          return { ...p, items: [...items.filter((m) => !have.has(m.id)), ...p.items], cursor: nextCursor, loadingOlder: false };
        }),
      )
      .catch(() => setState((p) => (p && p.id === conversationId ? { ...p, loadingOlder: false } : p)));
  }, [s, conversationId]);

  const deliver = useCallback(
    async (localId: string, body: string): Promise<Message | null> => {
      try {
        const real = await messagingApi.send(conversationId, body);
        setState((p) => {
          if (!p || p.id !== conversationId) return p;
          const rest = p.items.filter((m) => m.local_id !== localId);
          if (!real || rest.some((m) => m.id === real.id)) return { ...p, items: rest };
          const at = rest.findIndex(isLocal);
          return { ...p, items: at < 0 ? [...rest, real] : [...rest.slice(0, at), real, ...rest.slice(at)] };
        });
        if (!real) fetchLatest();
        return real;
      } catch {
        setState((p) =>
          p && p.id === conversationId
            ? { ...p, items: p.items.map((m) => (m.local_id === localId ? { ...m, status: "failed" as const } : m)) }
            : p,
        );
        return null;
      }
    },
    [conversationId, fetchLatest],
  );

  const send = useCallback(
    (body: string) => {
      if (myId === undefined) return Promise.resolve(null);
      const localId = `l${Date.now()}`;
      const temp: Message = {
        id: -Date.now(),
        conversation_id: conversationId,
        type: "text",
        body,
        media_url: null,
        media_type: null,
        sender: null,
        sender_id: myId,
        shared_post: null,
        reply_to: null,
        reactions: {},
        created_at: new Date().toISOString(),
        is_deleted: false,
        status: "sending",
        local_id: localId,
      };
      setState((p) =>
        p && p.id === conversationId
          ? { ...p, items: [...p.items, temp] }
          : { id: conversationId, items: [temp], cursor: null, error: null, loadingOlder: false },
      );
      return deliver(localId, body);
    },
    [myId, conversationId, deliver],
  );

  const retry = useCallback(
    (localId: string) => {
      const m = s?.items.find((x) => x.local_id === localId);
      if (!m || m.body === null) return Promise.resolve(null);
      setState((p) =>
        p && p.id === conversationId
          ? { ...p, items: p.items.map((x) => (x.local_id === localId ? { ...x, status: "sending" as const } : x)) }
          : p,
      );
      return deliver(localId, m.body);
    },
    [s, conversationId, deliver],
  );

  const setReactions = useCallback(
    (id: number, reactions: Record<string, number[]>) =>
      setState((p) =>
        p && p.id === conversationId ? { ...p, items: p.items.map((m) => (m.id === id ? { ...m, reactions } : m)) } : p,
      ),
    [conversationId],
  );

  return {
    messages: s?.items ?? [],
    loading: enabled && s === null,
    error: s?.error ?? null,
    hasOlder: !!s?.cursor,
    loadingOlder: !!s?.loadingOlder,
    loadOlder,
    send,
    retry,
    setReactions,
  };
}
