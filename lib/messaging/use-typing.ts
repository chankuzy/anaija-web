"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendBroadcast, subscribeBroadcast } from "@/lib/realtime/client";

const TTL_MS = 4000;
const PING_MS = 2500;

export function typingLabel(names: string[], direct: boolean): string {
  if (direct || names.length === 0) return "typing…";
  const first = names.map((n) => n.split(" ")[0] || "Someone");
  if (first.length === 1) return `${first[0]} is typing…`;
  if (first.length === 2) return `${first[0]} and ${first[1]} are typing…`;
  return `${first[0]} and ${first.length - 1} others are typing…`;
}

// Typing rides the conversation:{id} channel as a client broadcast. Tracked per person, so in a group or community
// one person stopping (or sending) never clears anyone else. Each ping lasts 4s on the other side.
export function useTyping(conversationId: number, myId: number | undefined, myName?: string | null) {
  const [typers, setTypers] = useState<Record<number, string>>({});
  const timers = useRef(new Map<number, number>());
  const lastSent = useRef(0);
  const name = useRef("");
  useEffect(() => {
    name.current = myName ?? "";
  });

  useEffect(() => {
    if (myId === undefined) return;
    lastSent.current = 0;
    const clocks = timers.current;
    const drop = (uid: number) => {
      const t = clocks.get(uid);
      if (t !== undefined) window.clearTimeout(t);
      clocks.delete(uid);
      setTypers((p) => {
        if (!(uid in p)) return p;
        const n = { ...p };
        delete n[uid];
        return n;
      });
    };
    const off = subscribeBroadcast(`conversation:${conversationId}`, {
      typing: (p) => {
        const u = p as { uid?: number; on?: boolean; name?: string };
        const uid = u.uid;
        if (typeof uid !== "number" || uid === myId) return;
        if (u.on === false) return drop(uid);
        setTypers((prev) =>
          uid in prev && (!u.name || prev[uid] === u.name) ? prev : { ...prev, [uid]: u.name || prev[uid] || "" },
        );
        const old = clocks.get(uid);
        if (old !== undefined) window.clearTimeout(old);
        clocks.set(uid, window.setTimeout(() => drop(uid), TTL_MS));
      },
      new_message: (p) => {
        const m = p as { sender_id?: number; sender?: { id?: number } | null };
        const uid = m.sender?.id ?? m.sender_id;
        if (typeof uid === "number") drop(uid);
      },
    });
    return () => {
      off();
      clocks.forEach((t) => window.clearTimeout(t));
      clocks.clear();
      setTypers({});
    };
  }, [conversationId, myId]);

  const ping = useCallback(() => {
    if (myId === undefined) return;
    const now = Date.now();
    if (now - lastSent.current < PING_MS) return;
    lastSent.current = now;
    sendBroadcast(`conversation:${conversationId}`, "typing", { uid: myId, on: true, name: name.current });
  }, [conversationId, myId]);

  const stop = useCallback(() => {
    if (myId === undefined || lastSent.current === 0) return;
    lastSent.current = 0;
    sendBroadcast(`conversation:${conversationId}`, "typing", { uid: myId, on: false });
  }, [conversationId, myId]);

  const names = useMemo(() => Object.values(typers), [typers]);
  return { typing: names.length > 0, names, ping, stop };
}
