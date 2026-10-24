"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

// Port of storyRingProvider (story_ring_avatar.dart): ring state for one user, derived from the stories feed.
//   unseen = a story group exists with has_unseen; seen = group exists, all watched; none = no story.
export type StoryRingState = "none" | "unseen" | "seen";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

// stories-index returns { stories: ... }. Accept a bare array of groups or a { groups | data } wrapper.
function groupsOf(raw: unknown): Rec[] {
  if (Array.isArray(raw)) return raw.filter(isRec);
  if (isRec(raw)) {
    for (const k of ["groups", "data"]) {
      const v = raw[k];
      if (Array.isArray(v)) return v.filter(isRec);
    }
  }
  return [];
}

function authorId(g: Rec): number | null {
  for (const k of ["author", "user"]) {
    const a = g[k];
    if (isRec(a) && typeof a.id === "number") return a.id;
  }
  return typeof g.user_id === "number" ? g.user_id : null;
}

// One shared request for every profile that mounts within 30s.
let cache: { at: number; p: Promise<Rec[]> } | null = null;
function loadGroups(): Promise<Rec[]> {
  const now = Date.now();
  if (cache && now - cache.at < 30_000) return cache.p;
  const p: Promise<Rec[]> = api
    .get<{ stories?: unknown }>("stories-index")
    .then((r) => groupsOf(r.stories))
    .catch(() => {
      if (cache?.p === p) cache = null;
      return [];
    });
  cache = { at: now, p };
  return p;
}

export function useStoryRing(userId: number | undefined, enabled: boolean): StoryRingState {
  const [res, setRes] = useState<{ id: number; ring: StoryRingState } | null>(null);

  useEffect(() => {
    if (!enabled || userId === undefined) return;
    let off = false;
    void loadGroups().then((groups) => {
      if (off) return;
      const g = groups.find((x) => authorId(x) === userId);
      const hasStories = g ? (Array.isArray(g.stories) ? g.stories.length > 0 : true) : false;
      const ring: StoryRingState = !g || !hasStories ? "none" : g.has_unseen === true ? "unseen" : "seen";
      setRes({ id: userId, ring });
    });
    return () => {
      off = true;
    };
  }, [userId, enabled]);

  return res && res.id === userId ? res.ring : "none";
}
