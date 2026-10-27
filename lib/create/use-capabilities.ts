"use client";

import { useCallback } from "react";
import { contentApi, type PublishingCapabilities } from "@/lib/api/content";
import { useAuth } from "@/lib/auth/auth-context";
import { useCached } from "@/lib/cache/swr";

/** What the signed-in account can publish. A 404/failed call (function not deployed) leaves caps null: nothing new is offered. */
export function useCapabilities() {
  const { status } = useAuth();
  const fetcher = useCallback(() => contentApi.capabilities(), []);
  const { data, error } = useCached<PublishingCapabilities>(status === "authed" ? "publishing-capabilities" : null, fetcher, {
    staleMs: 300_000,
    persist: false,
  });
  return { caps: data ?? null, loaded: data !== undefined || !!error };
}
