"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { ApiError } from "@/lib/api/client";
import { asUtc, messagingApi, parseMessage, parseReactions, type Message } from "@/lib/api/messaging";
import { mark, measure, PERF, sample } from "@/lib/dev/perf";
import { kvDelete } from "@/lib/cache/kv";
import { onCacheClear, peek, put } from "@/lib/cache/swr";
import { subscribeBroadcast } from "@/lib/realtime/client";
import { useInterval } from "./use-interval";

type TState = { id: number; items: Message[]; cursor: string | null; error: string | null; loadingOlder: boolean };

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
const isLocal = (m: Message) => m.status !== undefined;

// Threads live in memory and are mirrored to IndexedDB (last 80 messages plus unsent text), so a chat opens exactly
// as you left it, offline or after a cold start. The network only reconciles it. Wiped on sign-out / account change.
const MAX_THREADS = 20;
const MAX_ON_DISK = 30;
const KEEP_ON_DISK = 80;
const threadCache = new Map<number, TState>();
const saveTimers = new Map<number, number>();
const lastSaved = new Map<number, string>();
const diskKey = (id: number) => `thread:${id}`;
const isUnsent = (m: Message) => m.status === "failed" && !m.media_url && (m.type === "text" || m.type === "sticker");
const keepable = (m: Message) => !isLocal(m) || isUnsent(m);

onCacheClear(() => {
  threadCache.clear();
  lastSaved.clear();
  saveTimers.forEach((t) => window.clearTimeout(t));
  saveTimers.clear();
});

function seed(id: number): TState | null {
  const hit = threadCache.get(id);
  if (hit) return hit;
  const d = peek<TState>(diskKey(id))?.data;
  if (!d || d.id !== id) return null;
  const t: TState = { ...d, error: null, loadingOlder: false };
  threadCache.set(id, t);
  return t;
}

function persist(t: TState) {
  window.clearTimeout(saveTimers.get(t.id));
  saveTimers.set(
    t.id,
    window.setTimeout(() => {
      saveTimers.delete(t.id);
      const real = t.items.filter((m) => !isLocal(m));
      const kept = real.slice(-KEEP_ON_DISK);
      const snap: TState = {
        id: t.id,
        items: [...kept, ...t.items.filter(isUnsent)],
        cursor: kept.length === real.length ? t.cursor : kept[0] ? btoa(String(kept[0].id)) : null,
        error: null,
        loadingOlder: false,
      };
      const json = JSON.stringify(snap);
      if (lastSaved.get(t.id) === json) return;
      lastSaved.set(t.id, json);
      put(diskKey(t.id), snap);
      const next = [...(peek<number[]>("thread:index")?.data ?? []).filter((x) => x !== t.id), t.id];
      while (next.length > MAX_ON_DISK) {
        const old = next.shift();
        if (old !== undefined) {
          void kvDelete(diskKey(old));
          lastSaved.delete(old);
        }
      }
      put("thread:index", next);
    }, 600),
  );
}

function remember(t: TState) {
  const items = t.items.filter(keepable);
  if (items.length === 0) return;
  threadCache.delete(t.id);
  threadCache.set(t.id, { ...t, items, error: null, loadingOlder: false });
  while (threadCache.size > MAX_THREADS) {
    const oldest = threadCache.keys().next().value;
    if (oldest === undefined) break;
    threadCache.delete(oldest);
  }
  persist(t);
}

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
    cursor: base && older.length && base.cursor ? base.cursor : cursor,
    error: null,
    loadingOlder: false,
  };
}

// Live via conversation:{id} (new_message, reaction_updated, message_deleted). While that channel is joined the
// poll is only a 30s safety net; if it isn't, inbox_update pulses and a 6s poll keep the thread fresh.
export function useThread(conversationId: number, myId: number | undefined) {
  const enabled = myId !== undefined;
  const { pulse, live } = useMessages();
  const pulseN = pulse.id === conversationId ? pulse.n : 0;
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<TState | null>(() => seed(conversationId));
  const s = state && state.id === conversationId ? state : seed(conversationId);

  useEffect(() => {
    if (state) remember(state);
  }, [state]);

  useEffect(() => {
    mark(`open:${conversationId}`);
  }, [conversationId]);
  const haveCount = s?.items.length ?? 0;
  useEffect(() => {
    if (haveCount > 0) measure("open→messages committed", `open:${conversationId}`);
  }, [haveCount, conversationId]);

  const fetchLatest = useCallback(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState((p) =>
        p && p.id === conversationId
          ? p
          : (seed(conversationId) ?? { id: conversationId, items: [], cursor: null, error: "You're offline. This chat will load when you're back online.", loadingOlder: false }),
      );
      return;
    }
    messagingApi
      .messages(conversationId)
      .then(({ items, nextCursor }) =>
        setState((p) =>
          mergeLatest(p && p.id === conversationId ? p : seed(conversationId), conversationId, items, nextCursor),
        ),
      )
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
  useEffect(() => {
    if (enabled && pulseN > 0 && !joined) fetchLatest();
  }, [enabled, pulseN, joined, fetchLatest]);
  useInterval(fetchLatest, joined ? 30_000 : live ? 20_000 : 6000, enabled);

  useEffect(() => {
    if (!enabled) return;
    const off = subscribeBroadcast(
      `conversation:${conversationId}`,
      {
        new_message: (p) => {
          const m = parseMessage(p);
          if (!m) return;
          if (PERF && m.sender_id !== myId) {
            const ms = Date.now() - Date.parse(asUtc(m.created_at));
            if (Number.isFinite(ms)) sample("server→recipient (clock-skew sensitive)", ms);
          }
          setState((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            if (prev.items.some((x) => x.id === m.id)) return prev;
            // Our own send is confirmed by the HTTP response; don't double up while it is in flight.
            if (m.sender_id === myId && prev.items.some(isLocal)) return prev;
            const at = prev.items.findIndex(isLocal);
            const items = at < 0 ? [...prev.items, m] : [...prev.items.slice(0, at), m, ...prev.items.slice(at)];
            return { ...prev, items };
          });
        },
        reaction_updated: (p) => {
          const u = p as { message_id?: number; reactions?: unknown };
          if (typeof u.message_id !== "number") return;
          const reactions = parseReactions(u.reactions);
          setState((prev) =>
            prev && prev.id === conversationId
              ? { ...prev, items: prev.items.map((x) => (x.id === u.message_id ? { ...x, reactions } : x)) }
              : prev,
          );
        },
        message_deleted: (p) => {
          const u = p as { message_id?: number };
          if (typeof u.message_id !== "number") return;
          setState((prev) =>
            prev && prev.id === conversationId
              ? {
                  ...prev,
                  items: prev.items.map((x) =>
                    x.id === u.message_id ? { ...x, is_deleted: true, body: null, media_url: null, shared_post: null } : x,
                  ),
                }
              : prev,
          );
        },
        message_edited: (p) => {
          const u = p as { message_id?: number; body?: string; updated_at?: string; message?: unknown };
          if (typeof u.message_id !== "number") return;
          const full = parseMessage(u.message);
          setState((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            return {
              ...prev,
              items: prev.items.map((x) => {
                if (x.id !== u.message_id) return x;
                if (full) return full;
                return {
                  ...x,
                  body: u.body ?? x.body,
                  updated_at: u.updated_at ?? new Date().toISOString(),
                  is_edited: true,
                };
              }),
            };
          });
        },
      },
      setJoined,
    );
    return () => {
      off();
      setJoined(false);
    };
  }, [enabled, conversationId, myId]);

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

  // Stores pending options by localId for retry
  const pendingPayloads = useRef(new Map<string, { body?: string; type?: string; replyToId?: number; mediaKey?: string; mediaType?: string }>());

  const deliver = useCallback(
    async (
      localId: string,
      payload: { body?: string; type?: string; replyToId?: number; mediaKey?: string; mediaType?: string },
    ): Promise<Message | null> => {
      try {
        const t0 = performance.now();
        const real = await messagingApi.send(conversationId, {
          type: (payload.type as "text" | "image" | "video" | "audio" | "file" | "sticker") ?? "text",
          body: payload.body,
          reply_to_id: payload.replyToId,
          media_key: payload.mediaKey,
          media_type: payload.mediaType,
          client_temp_id: localId,
        });
        pendingPayloads.current.delete(localId);
        sample("send→ack", performance.now() - t0);
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

  // Media sends: the bubble appears first, then `prepare` uploads and hands back the storage key.
  // A failed upload leaves a failed bubble; retry re-runs the upload, not just the send.
  const pendingPrepare = useRef(new Map<string, () => Promise<{ mediaKey: string; mediaType: string }>>());
  const runPrepared = useCallback(
    async (
      localId: string,
      payload: { body?: string; type?: string; replyToId?: number; mediaKey?: string; mediaType?: string },
      prepare: () => Promise<{ mediaKey: string; mediaType: string }>,
    ): Promise<Message | null> => {
      try {
        const up = await prepare();
        payload.mediaKey = up.mediaKey;
        payload.mediaType = up.mediaType;
        pendingPrepare.current.delete(localId);
      } catch {
        setState((p) =>
          p && p.id === conversationId
            ? { ...p, items: p.items.map((m) => (m.local_id === localId ? { ...m, status: "failed" as const } : m)) }
            : p,
        );
        return null;
      }
      return deliver(localId, payload);
    },
    [conversationId, deliver],
  );

  const send = useCallback(
    (
      input:
        | string
        | {
            body?: string;
            type?: "text" | "audio" | "image" | "video" | "file" | "sticker";
            replyTo?: Message["reply_to"];
            mediaKey?: string;
            mediaType?: string;
            mediaUrl?: string;
            prepare?: () => Promise<{ mediaKey: string; mediaType: string }>;
          },
    ) => {
      if (myId === undefined) return Promise.resolve(null);
      const opts = typeof input === "string" ? { body: input, type: "text" as const } : input;
      const localId = `l${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (PERF) {
        mark(`paint:${localId}`);
        requestAnimationFrame(() => requestAnimationFrame(() => measure("send→first paint (excl. input latency)", `paint:${localId}`)));
      }
      const payload = {
        body: opts.body,
        type: opts.type ?? "text",
        replyToId: opts.replyTo?.id,
        mediaKey: opts.mediaKey,
        mediaType: opts.mediaType,
      };
      pendingPayloads.current.set(localId, payload);

      const temp: Message = {
        id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
        conversation_id: conversationId,
        type: opts.type ?? "text",
        body: opts.body ?? null,
        media_url: opts.mediaUrl ?? null,
        media_type: opts.mediaType ?? null,
        sender: null,
        sender_id: myId,
        shared_post: null,
        reply_to: opts.replyTo ?? null,
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
      if (opts.prepare) {
        pendingPrepare.current.set(localId, opts.prepare);
        return runPrepared(localId, payload, opts.prepare);
      }
      return deliver(localId, payload);
    },
    [myId, conversationId, deliver, runPrepared],
  );

  const retry = useCallback(
    (localId: string) => {
      const payload = pendingPayloads.current.get(localId);
      const m = s?.items.find((x) => x.local_id === localId);
      if (!m) return Promise.resolve(null);
      const effPayload = payload ?? {
        body: m.body ?? undefined,
        type: m.type,
        replyToId: m.reply_to?.id,
        mediaKey: undefined,
        mediaType: m.media_type ?? undefined,
      };
      setState((p) =>
        p && p.id === conversationId
          ? { ...p, items: p.items.map((x) => (x.local_id === localId ? { ...x, status: "sending" as const } : x)) }
          : p,
      );
      const prep = pendingPrepare.current.get(localId);
      if (prep && !effPayload.mediaKey) return runPrepared(localId, effPayload, prep);
      return deliver(localId, effPayload);
    },
    [s, conversationId, deliver, runPrepared],
  );

  // Back online: reconcile now, then send whatever was typed while offline, oldest first.
  const flush = useRef<() => void>(() => {});
  useEffect(() => {
    flush.current = () => {
      let chain: Promise<unknown> = Promise.resolve();
      for (const m of s?.items.filter(isUnsent) ?? []) {
        const id = m.local_id;
        if (id) chain = chain.then(() => retry(id));
      }
    };
  });
  const flushed = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const on = () => {
      fetchLatest();
      flush.current();
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [enabled, fetchLatest]);
  useEffect(() => {
    if (!enabled || flushed.current === conversationId || !navigator.onLine) return;
    if (s?.items.some(isUnsent)) {
      flushed.current = conversationId;
      flush.current();
    }
  });

  const editMessage = useCallback(
    async (messageId: number, newBody: string): Promise<boolean> => {
      const prevMsg = s?.items.find((x) => x.id === messageId);
      if (!prevMsg) return false;
      const oldBody = prevMsg.body;
      const oldEdited = prevMsg.is_edited;
      const oldUpdated = prevMsg.updated_at;

      // Optimistic update
      setState((p) => {
        if (!p || p.id !== conversationId) return p;
        return {
          ...p,
          items: p.items.map((x) =>
            x.id === messageId ? { ...x, body: newBody, is_edited: true, updated_at: new Date().toISOString() } : x,
          ),
        };
      });

      try {
        const res = await messagingApi.edit(conversationId, messageId, newBody);
        if (res) {
          setState((p) => {
            if (!p || p.id !== conversationId) return p;
            return {
              ...p,
              items: p.items.map((x) => (x.id === messageId ? { ...x, ...res, is_edited: true } : x)),
            };
          });
        }
        return true;
      } catch (err) {
        // Rollback
        setState((p) => {
          if (!p || p.id !== conversationId) return p;
          return {
            ...p,
            items: p.items.map((x) =>
              x.id === messageId ? { ...x, body: oldBody, is_edited: oldEdited, updated_at: oldUpdated } : x,
            ),
          };
        });
        throw err;
      }
    },
    [conversationId, s?.items],
  );

  const deleteMessage = useCallback(
    async (messageId: number, scope: "me" | "everyone"): Promise<boolean> => {
      const prevMsg = s?.items.find((x) => x.id === messageId);
      if (!prevMsg) return false;

      // Optimistic update
      setState((p) => {
        if (!p || p.id !== conversationId) return p;
        if (scope === "me") {
          return { ...p, items: p.items.filter((x) => x.id !== messageId) };
        }
        return {
          ...p,
          items: p.items.map((x) =>
            x.id === messageId ? { ...x, is_deleted: true, body: null, media_url: null, shared_post: null } : x,
          ),
        };
      });

      try {
        await messagingApi.delete(conversationId, messageId, scope);
        return true;
      } catch (err) {
        // Rollback
        setState((p) => {
          if (!p || p.id !== conversationId) return p;
          if (scope === "me") {
            // Reinsert at original position
            const idx = s?.items.findIndex((x) => x.id === messageId) ?? -1;
            const items = idx >= 0 ? [...p.items.slice(0, idx), prevMsg, ...p.items.slice(idx)] : [...p.items, prevMsg];
            return { ...p, items };
          }
          return {
            ...p,
            items: p.items.map((x) => (x.id === messageId ? prevMsg : x)),
          };
        });
        throw err;
      }
    },
    [conversationId, s?.items],
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
    editMessage,
    deleteMessage,
    setReactions,
  };
}
