"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { usersApi, type UserProfile } from "@/lib/api/users";
import { seedFollows } from "@/lib/feed/follow-store";

interface Data {
  key: string;
  profile: UserProfile | null;
  error: ApiError | null;
}

// A failed refresh never replaces a good profile with an error; errors only surface when there is nothing to show.
export function useProfile(username: string, enabled: boolean) {
  const [data, setData] = useState<Data | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${username}:${nonce}`;

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    usersApi
      .profile(username, ac.signal)
      .then((p) => {
        if (ac.signal.aborted) return;
        seedFollows([{ id: p.id, is_following: p.is_following }]);
        setData({ key, profile: p, error: null });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setData((prev) =>
          prev?.profile ? { ...prev, key } : { key, profile: null, error: e instanceof ApiError ? e : new ApiError(0, "Something went wrong.") },
        );
      });
    return () => ac.abort();
  }, [enabled, username, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = enabled && (data === null || data.key !== key);
  return { profile: data?.profile ?? null, error: data?.error ?? null, loading, reload };
}
