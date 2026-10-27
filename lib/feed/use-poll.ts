"use client";

// Poll results are viewer-specific, so they live outside the (shared, cached) feed payload.
// Cards on screen request their state together: one polls-state call per ~40ms window.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import { onCacheClear } from "@/lib/cache/swr";

export interface PollState {
  closed: boolean;
  options: number;
  multiple: boolean;
  total: number | null;
  counts: number[] | null;
  mine: number[];
  can_vote: boolean;
}

const states = new Map<number, PollState | "none">();
const subs = new Set<() => void>();
const queue = new Set<number>();
const inflight = new Set<number>();
let timer: ReturnType<typeof setTimeout> | null = null;
const emit = () => subs.forEach((f) => f());
onCacheClear(() => {
  states.clear();
  queue.clear();
  emit();
});

function flush() {
  timer = null;
  const ids = [...queue].slice(0, 30);
  ids.forEach((i) => {
    queue.delete(i);
    inflight.add(i);
  });
  if (queue.size) timer = setTimeout(flush, 40);
  if (!ids.length) return;
  api
    .get<{ polls: Record<string, PollState> }>("polls-state", { ids: ids.join(",") })
    .then((r) => ids.forEach((id) => states.set(id, r.polls?.[String(id)] ?? "none")))
    .catch(() => {}) // stays unknown: a later mount retries
    .finally(() => {
      ids.forEach((i) => inflight.delete(i));
      emit();
    });
}

function request(id: number) {
  if (states.has(id) || queue.has(id) || inflight.has(id)) return;
  queue.add(id);
  if (!timer) timer = setTimeout(flush, 40);
}

export function usePoll(id: number, enabled: boolean) {
  const subscribe = useCallback((cb: () => void) => {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }, []);
  const raw = useSyncExternalStore(
    subscribe,
    () => states.get(id),
    () => undefined,
  );
  useEffect(() => {
    if (enabled) request(id);
  }, [id, enabled]);

  const vote = useCallback(
    async (optionIds: number[]) => {
      const r = await api.post<{ poll: PollState }>("polls-vote", { post_id: id, option_ids: optionIds });
      states.set(id, r.poll);
      emit();
    },
    [id],
  );
  return { state: raw && raw !== "none" ? raw : null, vote };
}
