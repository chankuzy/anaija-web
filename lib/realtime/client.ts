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
const status = new Map<string, string>();
const counts = new Map<string, number>();
const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

export function subscribeBroadcast(topic: string, events: Record<string, Handler>, onJoined?: (joined: boolean) => void): () => void {
  const c = realtime();
  if (!c) return () => {};

  let entry = hub.get(topic);
  if (!entry) {
    const ch = c.channel(topic);
    const created: Entry = { ch, listeners: new Set(), joined: false, teardown: null };
    ch.on("broadcast", { event: "*" }, (m: { event?: string; payload?: unknown }) => {
      bump(`recv:${m.event ?? "?"}`);
      const data = m.payload ?? m;
      for (const l of created.listeners) {
        if (m.event) l.events[m.event]?.(data, m.event);
        l.events["*"]?.(data, m.event);
      }
    });
    ch.subscribe((s: string, err?: Error) => {
      status.set(topic, err ? `${s}: ${err.message}` : s);
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

// Console: __rt() answers "why are typing / online not working?" in one look.
export function rtDebug() {
  return {
    clientCreated: realtime() !== null,
    anonKeyInBundle: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    channels: Object.fromEntries(status),
    events: Object.fromEntries(counts),
  };
}
if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__rt = rtDebug;

// Fire a broadcast on a topic this client has already joined (used for typing). No-op until joined.
export function sendBroadcast(topic: string, event: string, payload: unknown) {
  const e = hub.get(topic);
  if (!e || !e.joined) {
    bump(`dropped:${event}`);
    return;
  }
  bump(`sent:${event}`);
  void e.ch.send({ type: "broadcast", event, payload });
}
