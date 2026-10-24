"use client";

import { useMessages } from "@/components/messaging/messages-context";

// Ring state for one user, derived from the shared stories feed that the Messages provider already keeps
// loaded and live (no separate request, no polling here).
//   unseen = a story group exists with has_unseen; seen = group exists, all watched; none = no story.
export type StoryRingState = "none" | "unseen" | "seen";

export function useStoryRing(userId: number | undefined, enabled: boolean): StoryRingState {
  const { groups } = useMessages();
  if (!enabled || userId === undefined) return "none";
  const g = groups.find((x) => x.author.id === userId);
  if (!g) return "none";
  return g.has_unseen ? "unseen" : "seen";
}
