import { api } from "./client";
import { normPost } from "./feed";
import type { Post } from "./feed-types";

export type DiscoverFilter = "for_you" | "marketplace";

export interface DiscoverItem {
  id: string;
  kind: "post" | "listing";
  post: Post;
  src: string | null;
  slot: number;
}

export interface DiscoverPage {
  items: DiscoverItem[];
  nextCursor: string | null;
  hasMore: boolean;
  caughtUp: boolean;
  sessionId: string | null;
}

interface RawItem {
  type: string;
  id: string;
  score?: number;
  data: Post;
  meta?: { src?: string | null; slot?: number } | null;
}

interface RawPage {
  items?: RawItem[];
  next_cursor?: string | null;
  has_more?: boolean;
  caught_up?: boolean;
  session_id?: string | null;
}

// Contract read from supabase/functions/discover + discover_providers.dart. Discover is content-only:
// anything that is not a post or listing is dropped, one bad item never blanks the grid.
export const discoverApi = {
  page: async (o: {
    filter: DiscoverFilter;
    cursor?: string | null;
    refresh?: boolean;
    signal?: AbortSignal;
  }): Promise<DiscoverPage> => {
    const res = await api.get<RawPage>(
      "discover",
      { filter: o.filter, cursor: o.cursor, refresh: o.refresh ? 1 : undefined },
      o.signal,
    );
    const items: DiscoverItem[] = [];
    const seen = new Set<string>();
    for (const r of res.items ?? []) {
      if (r.type !== "post" && r.type !== "listing") continue;
      if (!r.data || typeof r.data.id !== "number" || typeof r.id !== "string") continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({
        id: r.id,
        kind: r.type,
        post: normPost(r.data),
        src: r.meta?.src ?? null,
        slot: r.meta?.slot ?? 0,
      });
    }
    return {
      items,
      nextCursor: res.next_cursor ?? null,
      hasMore: res.has_more === true,
      caughtUp: res.caught_up === true,
      sessionId: res.session_id ?? null,
    };
  },
};
