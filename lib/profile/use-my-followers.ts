"use client";

import { useCallback, useMemo } from "react";
import { usersApi } from "@/lib/api/users";
import { useCached } from "@/lib/cache/swr";

const EMPTY: ReadonlySet<number> = new Set();

// Who follows ME, for the "Mutual" / "Follows you" labels. Capped at 5 pages (150 people). Cached, so the
// labels are there instantly on revisit and refresh quietly every few minutes.
export function useMyFollowerIds(username: string | null | undefined, enabled: boolean): ReadonlySet<number> {
  const key = username ? `followers-of:${username.toLowerCase()}` : null;

  const fetcher = useCallback(async () => {
    const ids: number[] = [];
    for (let page = 1; page <= 5; page++) {
      const r = await usersApi.followList("followers", username as string, page);
      for (const u of r.data) ids.push(u.id);
      if (!r.has_more) break;
    }
    return ids;
  }, [username]);

  const { data } = useCached<number[]>(key, fetcher, { enabled: enabled && !!username, staleMs: 5 * 60_000 });
  return useMemo(() => (data ? new Set(data) : EMPTY), [data]);
}
