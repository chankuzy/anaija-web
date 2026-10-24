"use client";

import { useCallback } from "react";
import { ApiError } from "@/lib/api/client";
import { usersApi, type UserProfile } from "@/lib/api/users";
import { onCacheClear, useCached } from "@/lib/cache/swr";
import { seedFollows } from "@/lib/feed/follow-store";

const failures = new Map<string, ApiError>();
onCacheClear(() => failures.clear());

// Cached per username: a revisit paints instantly from memory/disk and silently revalidates (staleMs 0 = every
// mount), so counts and follow state reconcile without a spinner. A failed refresh never replaces a good profile.
export function useProfile(username: string, enabled: boolean) {
  const key = `profile:${username.toLowerCase()}`;

  const fetcher = useCallback(async () => {
    try {
      const p = await usersApi.profile(username);
      failures.delete(key);
      seedFollows([{ id: p.id, is_following: p.is_following }]);
      return p;
    } catch (e) {
      failures.set(key, e instanceof ApiError ? e : new ApiError(0, "Something went wrong."));
      throw e;
    }
  }, [username, key]);

  const { data, loading, refreshing, error, refresh } = useCached<UserProfile>(key, fetcher, { enabled, staleMs: 0 });
  const reload = useCallback(() => void refresh(), [refresh]);

  return {
    profile: data ?? null,
    error: data ? null : error ? (failures.get(key) ?? new ApiError(0, error)) : null,
    loading,
    refreshing,
    reload,
  };
}
