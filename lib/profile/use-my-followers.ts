"use client";

import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api/users";

const EMPTY: ReadonlySet<number> = new Set();

// Who follows ME, for the "Mutual" / "Follows you" labels. Capped at 5 pages (150 people).
export function useMyFollowerIds(username: string | null | undefined, enabled: boolean): ReadonlySet<number> {
  const [state, setState] = useState<{ owner: string; ids: ReadonlySet<number> } | null>(null);

  useEffect(() => {
    if (!enabled || !username) return;
    let off = false;
    (async () => {
      const ids = new Set<number>();
      for (let page = 1; page <= 5; page++) {
        const r = await usersApi.followList("followers", username, page);
        for (const u of r.data) ids.add(u.id);
        if (!r.has_more) break;
      }
      if (!off) setState({ owner: username, ids });
    })().catch(() => {});
    return () => {
      off = true;
    };
  }, [enabled, username]);

  return state && state.owner === username ? state.ids : EMPTY;
}
