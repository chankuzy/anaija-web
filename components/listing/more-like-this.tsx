"use client";

import { useEffect, useState } from "react";
import { DiscoverGrid } from "@/components/discover/discover-grid";
import { PostViewer } from "@/components/discover/post-viewer";
import { discoverApi, type DiscoverItem } from "@/lib/api/discover";
import { feedApi } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";

const MAX = 24;

const fromPost = (p: Post): DiscoverItem => ({
  id: `${p.type === "listing" ? "l" : "p"}${p.id}`,
  kind: p.type === "listing" ? "listing" : "post",
  post: p,
  src: null,
  slot: 0,
});

// Continuity under a listing: same-type listings first, then other listings, then general posts, one flat grid.
// Signed in: marketplace + for-you discover. Guests: the public feed.
export function MoreLikeThis({ excludeId, type }: { excludeId: number; type: string }) {
  const { status } = useAuth();
  const [items, setItems] = useState<DiscoverItem[] | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const ac = new AbortController();
    const authed = status === "authed";
    (async () => {
      let all: DiscoverItem[] = [];
      try {
        if (authed) {
          const [m, f] = await Promise.allSettled([
            discoverApi.page({ filter: "marketplace", signal: ac.signal }),
            discoverApi.page({ filter: "for_you", signal: ac.signal }),
          ]);
          all = [...(m.status === "fulfilled" ? m.value.items : []), ...(f.status === "fulfilled" ? f.value.items : [])];
        } else {
          const r = await feedApi.page({ authed: false, scope: "for_you", signal: ac.signal });
          all = r.items.flatMap((i) => (i.type === "post" ? [fromPost(i.post)] : []));
        }
      } catch {
        /* nothing to show is fine */
      }
      if (ac.signal.aborted) return;
      const seen = new Set<number>([excludeId]);
      const out: DiscoverItem[] = [];
      for (const it of all) {
        if (seen.has(it.post.id)) continue;
        seen.add(it.post.id);
        out.push(it);
      }
      const rank = (it: DiscoverItem) => (it.kind === "listing" ? (it.post.listing_type === type ? 0 : 1) : 2);
      out.sort((a, b) => rank(a) - rank(b));
      setItems(out.slice(0, MAX));
    })();
    return () => ac.abort();
  }, [status, excludeId, type]);

  if (!items || items.length === 0) return null;
  const hasListings = items.some((i) => i.kind === "listing");

  return (
    <section className="mt-8">
      <h2 className="mb-3 px-5 text-[15px] font-bold text-fg">{hasListings ? "More like this" : "Keep exploring"}</h2>
      <DiscoverGrid items={items} videoBadge="play" onOpen={(i) => setViewer(i)} />
      {viewer !== null && (
        <PostViewer
          items={items}
          startIndex={viewer}
          onClose={() => setViewer(null)}
          onPatch={(id, p) => setItems((prev) => prev && prev.map((i) => (i.post.id === id ? { ...i, post: { ...i.post, ...p } } : i)))}
          onRemove={(id) => setItems((prev) => prev && prev.filter((i) => i.post.id !== id))}
        />
      )}
    </section>
  );
}
