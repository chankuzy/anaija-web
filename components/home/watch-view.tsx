"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeedView } from "@/components/feed/feed-view";
import { FeedSkeleton } from "@/components/feed/feed-states";
import type { Post } from "@/lib/api/feed-types";
import { postDetailApi } from "@/lib/api/post-detail";
import { useAuth } from "@/lib/auth/auth-context";
import { stagedForImmersive } from "@/lib/feed/handoff";

// Immersive Media surface. /watch?post=ID starts on that post and the media feed continues underneath (FeedView `pinned`).
// Source of the pinned post, best first: staged by Home/Discover, fetched with viewer flags (signed in),
// the public copy resolved on the server (`initial`: the only source for guests).
export function WatchView({ initial = null }: { initial?: Post | null }) {
  const sp = useSearchParams();
  const { status } = useAuth();
  const id = Number(sp.get("post"));
  const valid = Number.isInteger(id) && id > 0;
  const staged = valid ? stagedForImmersive(id) : null;
  const seed = valid && initial?.id === id ? initial : null;
  const fetchAuthed = valid && !staged && status === "authed";
  const [loaded, setLoaded] = useState<{ id: number; post: Post | null } | null>(null);

  useEffect(() => {
    if (!fetchAuthed) return;
    let off = false;
    postDetailApi
      .get(id)
      .then((post) => !off && setLoaded({ id, post }))
      .catch(() => !off && setLoaded({ id, post: null }));
    return () => {
      off = true;
    };
  }, [fetchAuthed, id]);

  const fetched = loaded?.id === id ? loaded.post : null;
  const waiting = fetchAuthed && !seed && loaded?.id !== id;
  if (status === "loading" || waiting) return <FeedSkeleton />;
  return <FeedView key={valid ? id : "feed"} videoOnly pinned={staged ?? fetched ?? seed} />;
}
