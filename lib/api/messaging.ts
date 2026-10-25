import { api } from "./client";
import { mediaUrl } from "./feed";
import { listOf, num, rec, str } from "./parse";

// Shapes follow message_notification_models.dart (Conversation, Message, SharedPost).
export interface MsgUser {
  id: number;
  name: string;
  username: string;
  avatar: string | null;
  request_status: string;
}

export interface Conversation {
  id: number;
  type: string;
  title: string | null;
  avatar: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_muted: boolean;
  other_user: MsgUser | null;
  request_status: string;
}

export interface SharedPost {
  id: number;
  type: string;
  caption: string | null;
  image: string | null;
  author: string | null;
  author_name: string | null;
  author_avatar: string | null;
  author_verified: boolean;
  price: string | null;
  is_video: boolean;
  // Number of images when the post is a multi-image post; 0 for video or when the payload does not say.
  image_count: number;
  // Seconds, videos only.
  duration: number | null;
  unavailable: boolean;
}

export interface Message {
  id: number;
  conversation_id: number;
  type: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  sender: MsgUser | null;
  sender_id: number;
  shared_post: SharedPost | null;
  reply_to: { id: number; body: string | null } | null;
  reactions: Record<string, number[]>;
  created_at: string;
  updated_at?: string | null;
  is_deleted: boolean;
  is_edited?: boolean;
  // Only set on rows that exist locally and are not confirmed yet.
  status?: "sending" | "failed";
  local_id?: string;
}

function parseUser(raw: unknown): MsgUser | null {
  const r = rec(raw);
  if (typeof r.id !== "number") return null;
  return {
    id: r.id,
    name: str(r.name) ?? "",
    username: str(r.username) ?? "",
    avatar: mediaUrl(str(r.avatar)),
    request_status: str(r.request_status) ?? "accepted",
  };
}

function parseConversation(raw: unknown): Conversation | null {
  const r = rec(raw);
  if (typeof r.id !== "number") return null;
  return {
    id: r.id,
    type: str(r.type) ?? "direct",
    title: str(r.title),
    avatar: mediaUrl(str(r.avatar)),
    last_message_body: typeof r.last_message_body === "string" ? r.last_message_body : null,
    last_message_at: str(r.last_message_at),
    unread_count: num(r.unread_count),
    is_muted: r.is_muted === true,
    other_user: parseUser(r.other_user),
    request_status: str(r.request_status) ?? "accepted",
  };
}

function parseShared(raw: unknown): SharedPost | null {
  const r = rec(raw);
  if (typeof r.id !== "number") return null;
  const a = rec(r.author);
  const media = Array.isArray(r.media) ? r.media : [];
  const hasVideoMedia = media.some((m) => (str(rec(m).type) ?? "").toLowerCase() === "video");
  const isVideo = r.is_video === true || hasVideoMedia || !!str(r.video_url);
  const duration = num(r.duration);
  return {
    id: r.id,
    type: str(r.type) ?? "post",
    caption: str(r.caption),
    image: mediaUrl(str(r.image) ?? str(r.thumbnail) ?? str(r.thumbnail_url)),
    author: str(a.username),
    author_name: str(a.name),
    author_avatar: mediaUrl(str(a.avatar)),
    author_verified: a.is_verified === true || a.campus_verified === true,
    price: str(rec(r.listing).formatted_price),
    is_video: isVideo,
    image_count: isVideo ? 0 : Math.max(num(r.image_count), num(r.media_count), media.length),
    duration: isVideo && duration > 0 ? duration : null,
    unavailable: r.unavailable === true,
  };
}

export function parseReactions(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(rec(raw))) {
    if (Array.isArray(v)) out[k] = v.filter((x): x is number => typeof x === "number");
  }
  return out;
}

export function parseMessage(raw: unknown): Message | null {
  const r = rec(raw);
  if (typeof r.id !== "number") return null;
  const type = str(r.type) ?? "text";
  const body = typeof r.body === "string" ? r.body : null;
  const media = mediaUrl(str(r.media_url));
  const sender = parseUser(r.sender);
  const reply = rec(r.reply_to);
  return {
    id: r.id,
    conversation_id: num(r.conversation_id),
    type,
    body,
    media_url: media,
    media_type: str(r.media_type),
    sender,
    sender_id: sender?.id ?? num(r.sender_id),
    shared_post: parseShared(r.shared_post),
    reply_to:
      typeof reply.id === "number"
        ? { id: reply.id, body: typeof reply.body === "string" ? reply.body : null }
        : null,
    reactions: parseReactions(r.reactions),
    created_at: str(r.created_at) ?? "",
    updated_at: str(r.edited_at) ?? str(r.updated_at),
    is_edited:
      typeof r.is_edited === "boolean"
        ? r.is_edited
        : !!(str(r.edited_at) || (str(r.updated_at) && str(r.updated_at) !== str(r.created_at))),
    // Same fallback as Message.fromJson.
    is_deleted:
      typeof r.is_deleted === "boolean"
        ? r.is_deleted
        : body === null && media === null && !["system", "post_share", "listing_share"].includes(type),
  };
}

export const convName = (c: Conversation) => c.title ?? c.other_user?.name ?? "Unknown";
export const convAvatar = (c: Conversation) => c.avatar ?? c.other_user?.avatar ?? null;
export const isPending = (c: Conversation) => c.request_status === "pending";
export const waitingOnOther = (c: Conversation) => c.other_user?.request_status === "pending";
export const isInquiry = (c: Conversation) => c.type === "listing_inquiry";

// Port of _buildPreviewText's label mapping.
export function previewOf(c: Conversation): string {
  const raw = c.last_message_body ?? "";
  if (raw === "[image]" || raw.includes("📷 Photo")) return "Photo";
  if (raw === "[video]" || raw.includes("🎥 Video")) return "Video";
  if (raw === "[audio]" || raw.includes("🎵 Audio") || raw.includes("Voice message")) return "Voice message";
  if (raw === "Shared a listing" || raw === "[listing_share]") return "Shared a listing";
  if (raw === "[post_share]" || raw === "Shared a post" || raw.includes("📎 Shared a post")) return "Shared a post";
  if (isInquiry(c) || raw.includes("🛍️ Shared a listing")) return raw.replace("🛍️ Shared a listing", "Listing inquiry");
  return raw;
}

export interface SendMessageOptions {
  type?: "text" | "audio" | "image" | "video" | "file";
  body?: string;
  media_key?: string;
  media_type?: string;
  reply_to_id?: number;
  client_temp_id?: string;
}

export const messagingApi = {
  inbox: async (signal?: AbortSignal): Promise<Conversation[]> => {
    const raw = await api.get<unknown>("conversations-inbox", undefined, signal);
    return listOf(raw, ["data", "conversations", "items"])
      .map(parseConversation)
      .filter((c): c is Conversation => c !== null);
  },

  // Oldest -> newest, deduped. nextCursor pages further back.
  messages: async (id: number, cursor?: string | null, signal?: AbortSignal) => {
    const raw = await api.get<unknown>(`conversations-messages/${id}`, { cursor }, signal);
    const seen = new Set<number>();
    const items = listOf(raw, ["data", "messages", "items"])
      .map(parseMessage)
      .filter((m): m is Message => m !== null && !seen.has(m.id) && !!seen.add(m.id))
      .sort((a, b) => a.id - b.id);
    const r = rec(raw);
    return { items, nextCursor: str(r.next_cursor) ?? str(r.cursor) };
  },

  send: async (id: number, input: string | SendMessageOptions): Promise<Message | null> => {
    const payload = typeof input === "string" ? { type: "text", body: input } : input;
    try {
      const raw = await api.post<unknown>(`conversations-send/${id}`, payload);
      return parseMessage(raw) ?? parseMessage(rec(raw).message) ?? parseMessage(rec(raw).data);
    } catch (err: unknown) {
      if (payload.type === "audio") {
        try {
          const fallback = { ...payload, type: "file" as const };
          const raw = await api.post<unknown>(`conversations-send/${id}`, fallback);
          return parseMessage(raw) ?? parseMessage(rec(raw).message) ?? parseMessage(rec(raw).data);
        } catch {
          throw err;
        }
      }
      throw err;
    }
  },

  edit: async (conversationId: number, messageId: number, body: string): Promise<Message | null> => {
    const raw = await api.patch<unknown>(`messages-update/${conversationId}/x/${messageId}`, { body });
    return parseMessage(raw) ?? parseMessage(rec(raw).message) ?? parseMessage(rec(raw).data);
  },

  delete: (conversationId: number, messageId: number, scope: "me" | "everyone" = "me") =>
    api.post<{ message: string }>(`messages-destroy/${conversationId}/x/${messageId}`, { scope }),

  markRead: (id: number, upToMessageId: number) =>
    api.post<unknown>(`messages-read/${id}`, { up_to_message_id: upToMessageId }).catch(() => undefined),

  react: async (conversationId: number, messageId: number, emoji: string) => {
    const r = await api.post<unknown>(`messages-react/${conversationId}/x/${messageId}`, { emoji });
    return parseReactions(rec(r).reactions);
  },

  respond: (id: number, action: "accept" | "decline" | "block") =>
    api.post<unknown>(`conversations-respond/${id}`, { action }),
};


export function asUtc(value: string): string {
  if (!value) return value;
  return /(?:Z|[+-]\\d{2}:\\d{2})$/i.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
}
