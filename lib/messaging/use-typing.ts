"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendBroadcast, subscribeBroadcast } from "@/lib/realtime/client";

// Typing rides the conversation:{id} channel as a client broadcast. Each ping lasts 4s on the other side.
export function useTyping(conversationId: number, myId: number | undefined) {
  const [typing, setTyping] = useState(false);
  const timer = useRef<number | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (myId === undefined) return;
    const clear = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      setTyping(false);
    };
    const off = subscribeBroadcast(`conversation:${conversationId}`, {
      typing: (p) => {
        const u = p as { uid?: number; on?: boolean };
        if (u.uid === myId) return;
        if (u.on === false) return clear();
        setTyping(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(clear, 4000);
      },
      new_message: () => clear(),
    });
    return () => {
      off();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [conversationId, myId]);

  const ping = useCallback(() => {
    if (myId === undefined) return;
    const now = Date.now();
    if (now - lastSent.current < 2500) return;
    lastSent.current = now;
    sendBroadcast(`conversation:${conversationId}`, "typing", { uid: myId, on: true });
  }, [conversationId, myId]);

  const stop = useCallback(() => {
    if (myId === undefined || lastSent.current === 0) return;
    lastSent.current = 0;
    sendBroadcast(`conversation:${conversationId}`, "typing", { uid: myId, on: false });
  }, [conversationId, myId]);

  return { typing, ping, stop };
}
