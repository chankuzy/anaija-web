"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Same setup as Flutter: the public anon key, no user session. All backend authorisation happens in the
// Edge Functions; this client only listens to broadcast channels. NEVER put the service-role key here.
let client: SupabaseClient | null | undefined;

export function realtime(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://eqwcndxdbfljsjxsduid.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } })
    : null;
  return client;
}

type Handler = (payload: unknown) => void;

// Subscribes to a broadcast topic; returns an unsubscribe. Without an anon key it is a no-op and callers poll.
export function subscribeBroadcast(topic: string, events: Record<string, Handler>, onJoined?: (joined: boolean) => void): () => void {
  const c = realtime();
  if (!c) return () => {};
  const ch = c.channel(topic);
  for (const [event, fn] of Object.entries(events)) {
    ch.on("broadcast", { event }, (m: { payload?: unknown }) => fn(m.payload ?? m));
  }
  ch.subscribe((status: string) => onJoined?.(status === "SUBSCRIBED"));
  return () => {
    void c.removeChannel(ch);
  };
}
