"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { discoveriesApi, type DiscoveriesStatus, type DiscoveryItem } from "@/lib/api/discoveries";
import type { Opportunity } from "@/lib/api/opportunities";

export interface DiscoveriesState {
  items: DiscoveryItem[];
  cursor: string | null;
  hasMore: boolean;
  status: DiscoveriesStatus;
  personalized: boolean;
  personalizationEnabled: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const INITIAL: DiscoveriesState = {
  items: [], cursor: null, hasMore: false, status: "ok", personalized: false, personalizationEnabled: true,
  loading: true, loadingMore: false, error: null,
};

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong.");

// Server-driven list: the server owns ranking, eligibility and expiry, the client only pages through it.
// Nothing is cached across visits, so an expired or closed opportunity can never be shown from a stale copy.
export function useDiscoveries(enabled: boolean) {
  const [s, setS] = useState<DiscoveriesState>(INITIAL);
  const req = useRef(0);
  const moreBusy = useRef(false);

  const load = useCallback((refresh: boolean) => {
    const id = ++req.current;
    moreBusy.current = false;
    setS((p) => ({ ...p, loading: true, error: null }));
    discoveriesApi
      .page({ refresh })
      .then((r) => {
        if (id !== req.current) return;
        setS({
          items: r.items, cursor: r.nextCursor, hasMore: r.hasMore, status: r.status, personalized: r.personalized,
          personalizationEnabled: r.personalizationEnabled, loading: false, loadingMore: false, error: null,
        });
      })
      .catch((e: unknown) => {
        if (id !== req.current) return;
        setS((p) => ({ ...p, loading: false, loadingMore: false, error: messageOf(e) }));
      });
  }, []);

  useEffect(() => {
    if (enabled) load(true);
  }, [enabled, load]);

  const loadMore = useCallback(() => {
    if (moreBusy.current || !s.cursor || !s.hasMore) return;
    moreBusy.current = true;
    const id = req.current;
    setS((p) => ({ ...p, loadingMore: true }));
    discoveriesApi
      .page({ cursor: s.cursor })
      .then((r) => {
        if (id !== req.current) return;
        setS((p) => {
          const have = new Set(p.items.map((i) => i.id));
          return { ...p, items: [...p.items, ...r.items.filter((i) => !have.has(i.id))], cursor: r.nextCursor, hasMore: r.hasMore, loadingMore: false };
        });
      })
      .catch(() => {
        if (id === req.current) setS((p) => ({ ...p, loadingMore: false }));
      })
      .finally(() => {
        moreBusy.current = false;
      });
  }, [s.cursor, s.hasMore]);

  const remove = useCallback((itemId: string) => {
    setS((p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }));
  }, []);

  const patchOpportunity = useCallback((oppId: number, patch: Partial<Opportunity>) => {
    setS((p) => ({
      ...p,
      items: p.items.map((i) => (i.type === "opportunity" && i.data.id === oppId ? { ...i, data: { ...i.data, ...patch } } : i)),
    }));
  }, []);

  return { ...s, reload: () => load(true), loadMore, remove, patchOpportunity };
}
