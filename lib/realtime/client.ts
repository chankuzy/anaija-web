"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

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

type Handler = (payload: unknown, event?: string) => void;
type Listener = { events: Record<string, Handler>; onJoined?: (joined: boolean) => void };
type Entry = { ch: RealtimeChannel; listeners: Set<Listener>; joined: boolean; teardown: number | null };

// One channel per topic, shared by every subscriber. Registering "*" as an event name receives everything.
const hub = new Map<string, Entry>();

export function subscribeBroadcast(topic: string, events: Record<string, Handler>, onJoined?: (joined: boolean) => void): () => void {
  const c = realtime();
  if (!c) return () => {};

  let entry = hub.get(topic);
  if (!entry) {
    const ch = c.channel(topic);
    const created: Entry = { ch, listeners: new Set(), joined: false, teardown: null };
    ch.on("broadcast", { event: "*" }, (m: { event?: string; payload?: unknown }) => {
      const data = m.payload ?? m;
      for (const l of created.listeners) {
        if (m.event) l.events[m.event]?.(data, m.event);
        l.events["*"]?.(data, m.event);
      }
    });
    ch.subscribe((s: string) => {
      created.joined = s === "SUBSCRIBED";
      for (const l of created.listeners) l.onJoined?.(created.joined);
    });
    hub.set(topic, created);
    entry = created;
  }

  const e = entry;
  if (e.teardown !== null) {
    window.clearTimeout(e.teardown);
    e.teardown = null;
  }
  const listener: Listener = { events, onJoined };
  e.listeners.add(listener);
  if (e.joined) onJoined?.(true);

  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size > 0) return;
    // Delayed so React strict-mode remounts reuse the channel instead of racing a teardown.
    e.teardown = window.setTimeout(() => {
      if (e.listeners.size === 0 && hub.get(topic) === e) {
        hub.delete(topic);
        void c.removeChannel(e.ch);
      }
    }, 400);
  };
}
