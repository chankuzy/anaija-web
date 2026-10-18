import { ApiError } from "@/lib/api/client";
import { socialApi } from "@/lib/api/social";

// Port of feed_event_tracker.dart. Reports raw metrics only; the server classifies and dedupes by event_id.
// Not persisted across reloads (Flutter persists to SharedPreferences); a keepalive flush covers tab close.
type Ev = Record<string, unknown>;
interface Current {
  postId: number;
  isVideo: boolean;
  sessionId: string | null;
  src: string | null;
  slot: number;
  since: number | null;
}

const MAX_BATCH = 40;
const MAX_QUEUE = 300;
const FLUSH_AT = 20;
const MIN_DWELL_MS = 250;
const INTERVAL_MS = 8000;

class FeedEventTracker {
  private queue: Ev[] = [];
  private impressed = new Set<number>();
  private holds = new Set<string>();
  private cur: Current | null = null;
  private enabled = false;
  private flushing = false;
  private failures = 0;
  private nextTry = 0;
  private timer: number | null = null;
  private listening = false;

  private onVisibility = () => {
    if (document.visibilityState === "hidden") {
      this.hold("tab");
      this.flushBeacon();
    } else {
      this.release("tab");
    }
  };
  private onPageHide = () => {
    this.leave();
    this.flushBeacon();
  };

  setEnabled(v: boolean) {
    if (v === this.enabled) return;
    this.enabled = v;
    if (v) this.start();
    else this.stop();
  }

  private start() {
    if (!this.listening) {
      this.listening = true;
      document.addEventListener("visibilitychange", this.onVisibility);
      window.addEventListener("pagehide", this.onPageHide);
    }
    if (this.timer === null) this.timer = window.setInterval(() => void this.flush(), INTERVAL_MS);
  }

  private stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
    this.impressed.clear();
    this.cur = null;
  }

  show(o: { postId: number; isVideo: boolean; sessionId: string | null; src: string | null; slot: number }) {
    if (!this.enabled) return;
    const c = this.cur;
    if (c && c.postId === o.postId) {
      if (this.holds.size === 0 && c.since === null) c.since = Date.now();
      return;
    }
    this.emitConsume(c);
    this.cur = { ...o, since: this.holds.size === 0 ? Date.now() : null };
    if (this.impressed.add(o.postId)) {
      this.add({
        kind: "impression",
        post_id: o.postId,
        ...(o.sessionId ? { session_id: o.sessionId } : {}),
        ...(o.src ? { src: o.src } : {}),
        slot: o.slot,
      });
    }
  }

  // Pause the dwell clock (tab hidden, overlay open). Emits what was watched so far.
  hold(reason: string) {
    const first = this.holds.size === 0;
    this.holds.add(reason);
    if (first && this.cur) {
      this.emitConsume(this.cur);
      this.cur.since = null;
    }
  }

  release(reason: string) {
    this.holds.delete(reason);
    if (this.holds.size === 0 && this.cur && this.cur.since === null) this.cur.since = Date.now();
  }

  // The viewer moved to something that isn't a post (people page, caught-up page).
  leave() {
    this.emitConsume(this.cur);
    this.cur = null;
  }

  suggestion(kind: string, targetUserId: number, sessionId: string | null) {
    this.add({
      kind,
      target_user_id: targetUserId,
      ...(sessionId ? { session_id: sessionId } : {}),
      surface: "feed",
    });
  }

  private emitConsume(c: Current | null) {
    if (!c || c.since === null) return;
    const dwell = Math.min(Date.now() - c.since, 3_600_000);
    if (dwell < MIN_DWELL_MS) return;
    this.add({
      kind: "consume",
      post_id: c.postId,
      ...(c.sessionId ? { session_id: c.sessionId } : {}),
      ...(c.src ? { src: c.src } : {}),
      slot: c.slot,
      dwell_ms: dwell,
      watch_ms: c.isVideo ? dwell : 0, // upper bound; the server caps it at dwell + 1s
      loops: 0,
    });
  }

  private add(e: Ev) {
    if (!this.enabled) return;
    e.event_id = crypto.randomUUID();
    this.queue.push(e);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    if (this.queue.length >= FLUSH_AT) void this.flush();
  }

  async flush() {
    if (!this.enabled || this.flushing || this.queue.length === 0 || Date.now() < this.nextTry) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const n = Math.min(MAX_BATCH, this.queue.length);
        const batch = this.queue.slice(0, n);
        try {
          await socialApi.sendEvents(batch);
          this.queue.splice(0, n);
          this.failures = 0;
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            this.queue.length = 0;
            break;
          }
          if (e instanceof ApiError && (e.status === 413 || e.status === 422)) {
            this.queue.splice(0, n); // malformed for the server: never retry
            continue;
          }
          this.failures++;
          this.nextTry = Date.now() + Math.min(300, 5 * 2 ** Math.min(this.failures, 6)) * 1000;
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  // Tab hidden or closing: keepalive fetch so the batch survives the page going away.
  private flushBeacon() {
    if (!this.enabled) return;
    for (let i = 0; i < 3 && this.queue.length > 0; i++) {
      const batch = this.queue.splice(0, MAX_BATCH);
      try {
        void fetch("/api/fn/feed-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
          credentials: "same-origin",
        }).catch(() => {});
      } catch {
        /* nothing more we can do */
      }
    }
  }
}

export const feedEvents = new FeedEventTracker();
