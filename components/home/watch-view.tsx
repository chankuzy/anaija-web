"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeedView } from "@/components/feed/feed-view";
import { FeedSkeleton } from "@/components/feed/feed-states";
import type { Post } from "@/lib/api/feed-types";
import { postDetailApi } from "@/lib/api/post-detail";
import { useAuth } from "@/lib/auth/auth-context";
import { stagedForImmersive } from "@/lib/feed/handoff";

// Immersive surface: reels only. /watch?post=ID starts on that post (staged by Home, or fetched on a direct visit)
// and the video feed continues underneath, via FeedView's `pinned`.
export function WatchView() {
  const sp = useSearchParams();
  const { status } = useAuth();
  const id = Number(sp.get("post"));
  const valid = Number.isInteger(id) && id > 0;
  const staged = valid ? stagedForImmersive(id) : null;
  const needFetch = valid && !staged && status === "authed";
  const [loaded, setLoaded] = useState<{ id: number; post: Post | null } | null>(null);

  useEffect(() => {
    if (!needFetch) return;
    let off = false;
    postDetailApi
      .get(id)
      .then((post) => !off && setLoaded({ id, post }))
      .catch(() => !off && setLoaded({ id, post: null }));
    return () => {
      off = true;
    };
  }, [needFetch, id]);

  if (status === "loading" || (needFetch && loaded?.id !== id)) return <FeedSkeleton />;
  const pinned = staged ?? (loaded?.id === id ? loaded.post : null);
  return <FeedView key={valid ? id : "feed"} videoOnly pinned={pinned} />;
}
