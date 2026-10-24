import { api } from "./client";
import { mediaUrl } from "./feed";
import { asUtc } from "./messaging";
import { listOf, rec, str } from "./parse";
import { usersApi } from "./users";

// Contracts follow conversation_info_provider.dart: conversations-info/{id} (+ ?media=1 for the shared items).
export type SharedKind = "image" | "video" | "file" | "post";

export interface SharedItem {
  kind: SharedKind;
  url: string | null;
  name: string | null;
  postId: number | null;
  postType: string | null;
  thumb: string | null;
  postIsVideo: boolean;
  createdAt: string;
}

export interface ConversationInfo {
  isMuted: boolean;
  peerLastSeen: string | null;
}

const KINDS = new Set(["image", "video", "file", "post"]);

function parseItem(raw: unknown): SharedItem | null {
  const r = rec(raw);
  const kind = str(r.kind) ?? "image";
  if (!KINDS.has(kind)) return null;
  const post = rec(r.post);
  const postId = typeof post.id === "number" ? post.id : null;
  if (kind === "post" && postId === null) return null;
  return {
    kind: kind as SharedKind,
    url: mediaUrl(str(r.url)),
    name: str(r.name),
    postId,
    postType: str(post.type),
    thumb: mediaUrl(str(post.image)),
    postIsVideo: post.is_video === true,
    createdAt: str(r.created_at) ?? "",
  };
}

// Port of seenLabel().
export function seenLabel(iso: string): string {
  const t = new Date(asUtc(iso));
  if (Number.isNaN(t.getTime())) return "";
  const now = new Date();
  const mid = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((mid(now) - mid(t)) / 86_400_000);
  if (days <= 0) return "Seen today";
  if (days === 1) return "Seen yesterday";
  if (days < 7) return `Seen ${t.toLocaleDateString("en-NG", { weekday: "short" })}`;
  return `Seen ${t.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`;
}

export const conversationInfoApi = {
  info: async (id: number, signal?: AbortSignal): Promise<ConversationInfo> => {
    const r = rec(await api.get<unknown>(`conversations-info/${id}`, undefined, signal));
    return { isMuted: r.is_muted === true, peerLastSeen: str(r.peer_last_seen_at) };
  },

  media: async (id: number, signal?: AbortSignal): Promise<SharedItem[]> => {
    const raw = await api.get<unknown>(`conversations-info/${id}`, { media: 1 }, signal);
    return listOf(raw, ["items", "data"])
      .map(parseItem)
      .filter((i): i is SharedItem => i !== null);
  },

  // Returns the mute state the server ended up with.
  setMuted: async (id: number, want: boolean): Promise<boolean> => {
    const r = rec(await api.post<unknown>(`conversations-mute/${id}`, { muted: want, is_muted: want }));
    const v = r.is_muted ?? r.muted;
    return typeof v === "boolean" ? v : want;
  },

  // users-block toggles. If our list was stale and it did the opposite, toggle once more (same as unblock in settings).
  setBlocked: async (userId: number, want: boolean): Promise<boolean> => {
    let now = await usersApi.toggleBlock(userId);
    if (now !== want) now = await usersApi.toggleBlock(userId);
    return now;
  },
};
