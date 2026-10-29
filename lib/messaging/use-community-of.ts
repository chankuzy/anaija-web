"use client";

import { communitiesApi, type MineRow } from "@/lib/api/communities";
import type { Conversation } from "@/lib/api/messaging";
import { useAuth } from "@/lib/auth/auth-context";
import { useCached } from "@/lib/cache/swr";

/** The community whose chat room this conversation is, or null for ordinary chats. One shared, cached lookup. */
export function useCommunityOf(conv: Conversation | null): MineRow | null {
  const { status } = useAuth();
  const on = status === "authed" && !!conv && conv.type !== "direct" && conv.type !== "listing_inquiry";
  const { data } = useCached<MineRow[]>(on ? "messages:community-map" : null, () => communitiesApi.mine(), {
    staleMs: 120_000,
    persist: false,
  });
  return on && conv ? (data?.find((r) => r.chat_conversation_id === conv.id) ?? null) : null;
}
