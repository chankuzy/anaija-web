"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { messagingApi, normMsg, type Message, type MsgUser } from "@/lib/api/messaging";
import { subscribeBroadcast } from "@/lib/realtime/client";

export interface ThreadData {
  convId: number;
  messages: Message[];
  cursor: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
}

const isPending = (m: Message) => m.state !== undefined;
const arrange = (confirmed: Map<number, Message>, pending: Message[]) => [
  ...[...confirmed.values()].sort((a, b) => a.id - b.id),
  ...pending,
];

// Union of what we already have and what the server says; pending sends survive until their echo arrives.
function mergeServer(prev: Message[], server: Message[]): Message[] {
  const confirmed = new Map<number, Message>();
  for (const m of prev) if (!isPending(m)) confirmed.set(m.id, m);
  for (const m of server) confirmed.set(m.id, m);
  const echoed = new Set(server.map((m) => m.client_temp_id).filter(Boolean));
  return arrange(confirmed, prev.filter((m) => isPending(m) && !(m.client_temp_id && echoed.has(m.client_temp_id))));
}

// A realtime message or an HTTP response. Reconciles our own optimistic row by client_temp_id.
function upsert(prev: Message[], m: Message): Message[] {
  const confirmed = new Map<number, Message>();
  for (const x of prev) if (!isPending(x)) confirmed.set(x.id, x);
  confirmed.set(m.id, m);
  return arrange(confirmed, prev.filter((x) => isPending(x) && !(m.client_temp_id && x.client_temp_id === m.client_temp_id)));
}

const msgOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");
let tempSeq = 0;

export function previewOf(m: Message): string {
  if (m.is_deleted) return "Message deleted";
  if (m.body?.trim() && m.type !== "file") return m.body.trim();
  switch (m.type) {
    case "image": return "Photo";
    case "video": return "Video";
    case "file": return m.body?.trim() || "File";
    case "listing_share": return "Shared a listing";
    case "post_share": return "Shared a post";
    default: return m.body?.trim() || "Message";
  }
}

export function useThread(convId: number, me: MsgUser | null, onIncoming: (m: Message) => void) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [joined, setJoined] = useState(false);
  const [nonce, setNonce] = useState(0);
  const incoming = useRef(onIncoming);
  useEffect(() => {
    incoming.current = onIncoming;
  });

  const patchAll = useCallback(
    (fn: (l: Message[]) => Message[]) => setData((p) => (p && p.convId === convId ? { ...p, messages: fn(p.messages) } : p)),
    [convId],
  );

  useEffect(() => {
    const ac = new AbortController();
    messagingApi
      .messages(convId, null, ac.signal)
      .then((r) => {
        if (ac.signal.aborted) return;
        setData((p) => ({
          convId,
          messages: mergeServer(p?.convId === convId ? p.messages : [], r.messages),
          cursor: r.next_cursor,
          hasMore: r.has_more,
          loadingMore: false,
          error: null,
        }));
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setData((p) => (p?.convId === convId ? p : { convId, messages: [], cursor: null, hasMore: false, loadingMore: false, error: msgOf(e) }));
      });
    return () => ac.abort();
  }, [convId, nonce]);

  useEffect(() => {
    const unsub = subscribeBroadcast(
      `conversation:${convId}`,
      {
        new_message: (p) => {
          const m = normMsg(p as Message);
          patchAll((l) => upsert(l, m));
          incoming.current(m);
        },
        reaction_updated: (p) => {
          const u = p as { message_id: number; reactions: Record<string, number[]> };
          patchAll((l) => l.map((x) => (x.id === u.message_id ? { ...x, reactions: u.reactions ?? {} } : x)));
        },
        message_deleted: (p) => {
          const u = p as { message_id: number };
          patchAll((l) =>
            l.map((x) => (x.id === u.message_id ? { ...x, is_deleted: true, body: null, media_url: null, shared_post: null } : x)),
          );
        },
      },
      setJoined,
    );
    return () => {
      unsub();
      setJoined(false);
    };
  }, [convId, patchAll]);

  // Broadcast has no backlog: poll quietly, fast while the socket isn't joined, slow as a safety net otherwise.
  useEffect(() => {
    const quiet = () => {
      if (document.visibilityState !== "visible") return;
      messagingApi
        .messages(convId, null)
        .then((r) => patchAll((l) => mergeServer(l, r.messages)))
        .catch(() => {});
    };
    const id = window.setInterval(quiet, joined ? 30_000 : 8_000);
    document.addEventListener("visibilitychange", quiet);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", quiet);
    };
  }, [convId, joined, patchAll]);

  const post = useCallback(
    async (m: Message): Promise<string | null> => {
      try {
        const real = await messagingApi.send(convId, {
          body: m.body ?? "",
          type: "text",
          client_temp_id: m.client_temp_id!,
          ...(m.reply_to ? { reply_to_id: m.reply_to.id } : {}),
        });
        patchAll((l) => upsert(l, real));
        return null;
      } catch (e) {
        patchAll((l) => l.map((x) => (isPending(x) && x.client_temp_id === m.client_temp_id ? { ...x, state: "failed" } : x)));
        return msgOf(e);
      }
    },
    [convId, patchAll],
  );

  const send = useCallback(
    (body: string, replyTo: Message | null) => {
      const temp: Message = {
        id: -++tempSeq,
        conversation_id: convId,
        type: "text",
        body,
        is_deleted: false,
        client_temp_id: crypto.randomUUID(),
        media_url: null,
        media_type: null,
        reactions: {},
        reply_to: replyTo ? { id: replyTo.id, body: previewOf(replyTo) } : null,
        shared_post: null,
        sender: me,
        created_at: new Date().toISOString(),
        state: "sending",
      };
      patchAll((l) => [...l, temp]);
      return post(temp);
    },
    [convId, me, patchAll, post],
  );

  const retry = useCallback(
    (m: Message) => {
      patchAll((l) => l.map((x) => (x.client_temp_id === m.client_temp_id && isPending(x) ? { ...x, state: "sending" } : x)));
      return post(m);
    },
    [patchAll, post],
  );

  const cur = data && data.convId === convId ? data : null;
  const loadOlder = useCallback(() => {
    if (!cur || !cur.hasMore || !cur.cursor || cur.loadingMore) return;
    const cursor = cur.cursor;
    setData((p) => (p && p.convId === convId ? { ...p, loadingMore: true } : p));
    messagingApi
      .messages(convId, cursor)
      .then((r) =>
        setData((p) =>
          p && p.convId === convId
            ? { ...p, messages: mergeServer(p.messages, r.messages), cursor: r.next_cursor, hasMore: r.has_more, loadingMore: false }
            : p,
        ),
      )
      .catch(() => setData((p) => (p && p.convId === convId ? { ...p, loadingMore: false } : p)));
  }, [cur, convId]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: cur, loading: cur === null, joined, send, retry, loadOlder, patchAll, reload };
}
