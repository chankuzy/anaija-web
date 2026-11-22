"use client";

import { useEffect, useState } from "react";
import { MarketCard } from "@/components/market/market-view";
import { api } from "@/lib/api/client";
import { normPost } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";

const MAX = 6;

// "You might also like": other listings of the same type from the viewer's campus, two per row on mobile.
// Signed-in only (marketplace-index needs a session); renders nothing when there is nothing to show.
export function SimilarListings({ excludeId, type }: { excludeId: number; type: string }) {
  const [items, setItems] = useState<Post[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api
      .get<{ listings?: Post[] }>("marketplace-index", { listing_type: type, sort: "relevance" }, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        const list = (res.listings ?? []).map((p) => normPost(p)).filter((p) => p.id !== excludeId);
        // Keep an even count so the two-column grid never ends on a lone card.
        const n = Math.min(MAX, list.length - (list.length % 2));
        setItems(list.slice(0, n));
      })
      .catch(() => !ac.signal.aborted && setItems([]));
    return () => ac.abort();
  }, [excludeId, type]);

  if (!items || items.length === 0) return null;
  return (
    <section className="mt-8 px-4">
      <h2 className="mb-3 text-[18px] font-bold tracking-tight text-fg">You might also like</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((p) => (
          <MarketCard key={p.id} post={p} />
        ))}
      </div>
    </section>
  );
}
