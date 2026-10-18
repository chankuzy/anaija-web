import { api } from "./client";
import { mediaUrl } from "./feed";

// Server timestamps from "timestamp without time zone" columns arrive without a zone; they are UTC.
export const asUtc = (s: string) => (/(Z|[+-]\d\d(:?\d\d)?)$/i.test(s) ? s : `${s}Z`);

export interface MsgUser {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
}
export interface ConvUser extends MsgUser {
  request_status?: string;
}
export interface Conversation {
  id: number;
  type: string; // direct | listing_inquiry | group
  title: string | null;
  avatar: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_muted: boolean;
  request_status: string; // mine: accepted | pending | declined
  other_user: ConvUser | null;
}
export interface SharedPost {
  id: number;
  type: string;
  subtype: string | null;
  caption: string | null;
  image: string | null;
  is_video: boolean;
  media_count: number;
  unavailable: boolean;
  author: { name: string | null; username: string | null; avatar: string | null } | null;
  listing: { price: number; formatted_price: string; status: string } | null;
}
export interface Message {
  id: number;
  conversation_id: number;
  type: string; // text | image | video | file | post_share | listing_share
  body: string | null;
  is_deleted: boolean;
  client_temp_id: string | null;
  media_url: string | null;
  media_type: string | null;
  reactions: Record<string, number[]>;
  reply_to: { id: number; body: string | null } | null;
  shared_post: SharedPost | null;
  sender: MsgUser | null;
  created_at: string;
  state?: "sending" | "failed"; // local only
}

export const convName = (c: Conversation) => c.title || c.other_user?.name || c.other_user?.username || "Conversation";
export const convAvatar = (c: Conversation) => c.avatar ?? c.other_user?.avatar ?? null;

const normConv = (c: Conversation): Conversation => ({
  ...c,
  avatar: mediaUrl(c.avatar),
  other_user: c.other_user ? { ...c.other_user, avatar: mediaUrl(c.other_user.avatar) } : null,
});

export function normMsg(m: Message): Message {
  return {
    ...m,
    created_at: asUtc(m.created_at),
    media_url: mediaUrl(m.media_url),
    reactions: m.reactions ?? {},
    sender: m.sender ? { ...m.sender, avatar: mediaUrl(m.sender.avatar) } : null,
    shared_post: m.shared_post
      ? {
          ...m.shared_post,
          image: mediaUrl(m.shared_post.image),
          author: m.shared_post.author ? { ...m.shared_post.author, avatar: mediaUrl(m.shared_post.author.avatar) } : null,
        }
      : null,
  };
}

interface Page {
  messages?: Message[];
  next_cursor?: string | null;
  has_more?: boolean;
}

// Contracts read from supabase/functions/conversations-* and messages-* + messagingService.ts.
export const messagingApi = {
  inbox: async (signal?: AbortSignal) =>
    ((await api.get<{ data?: Conversation[] }>("conversations-inbox", undefined, signal)).data ?? []).map(normConv),

  // Page comes back oldest -> newest. Fetching marks the conversation read server-side.
  messages: async (id: number, cursor: string | null, signal?: AbortSignal) => {
    const r = await api.get<Page>(`conversations-messages/${id}`, { cursor }, signal);
    return { messages: (r.messages ?? []).map(normMsg), next_cursor: r.next_cursor ?? null, has_more: r.has_more === true };
  },
  send: async (id: number, body: { body: string; type: "text"; client_temp_id: string; reply_to_id?: number }) =>
    normMsg(await api.post<Message>(`conversations-send/${id}`, body)),
  react: (cid: number, mid: number, emoji: string) =>
    api.post<{ reactions: Record<string, number[]> }>(`messages-react/${cid}/x/${mid}`, { emoji }),
  destroy: (cid: number, mid: number) => api.delete<{ message: string }>(`messages-destroy/${cid}/x/${mid}`, { scope: "everyone" }),
  respond: (cid: number, action: "accept" | "decline" | "block") => api.post<{ status: string }>(`conversations-respond/${cid}`, { action }),
  mute: (cid: number, isMuted: boolean) => api.post<{ is_muted: boolean }>(`conversations-mute/${cid}`, { is_muted: isMuted }),
  clear: (cid: number) => api.post<{ message: string }>(`conversations-clear/${cid}`, {}),
  read: (cid: number, upTo: number) => api.post<{ ok: boolean }>(`messages-read/${cid}`, { up_to_message_id: upTo }),
  info: (cid: number) => api.get<{ is_muted: boolean; peer_last_seen_at: string | null }>(`conversations-info/${cid}`),
  open: (userId: number) => api.post<{ conversation_id: number; existing: boolean }>("conversations-open", { user_id: userId }),
};
