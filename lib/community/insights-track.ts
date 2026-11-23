import { api } from "@/lib/api/client";

// Reach tracking for Community Insights. The server keeps one row per member, post and day, so repeats are counted as
// hits and never as extra unique viewers. Failures are silent: analytics must never get in a reader's way.
const opened = new Set<number>();
const seen = new Set<string>();
const queue = new Map<number, number[]>();
let timer: number | null = null;
const MAX = 20;

export function trackCommunityOpen(id: number) {
  if (opened.has(id)) return;
  opened.add(id);
  void api.post(`communities/track/${id}`, { kind: "community_open" }).catch(() => {});
}

function flush() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  const batches = [...queue.entries()];
  queue.clear();
  for (const [cid, ids] of batches) {
    void api.post(`communities/track/${cid}`, { kind: "post_open", post_ids: ids.slice(0, MAX) }).catch(() => {});
  }
}

export function trackPostView(communityId: number, postId: number) {
  const k = `${communityId}:${postId}`;
  if (seen.has(k)) return;
  seen.add(k);
  const list = queue.get(communityId) ?? [];
  list.push(postId);
  queue.set(communityId, list);
  if (list.length >= MAX) flush();
  else if (timer === null) timer = window.setTimeout(flush, 5000);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
