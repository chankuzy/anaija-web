import { api } from "./client";
import { mediaUrl } from "./feed";
import { bool, listOf, rec, str } from "./parse";

// Shapes follow story_models.dart. stories-index returns { stories: [group, ...] }, one group per author.
export interface StoryMedia {
  id: number;
  type: string;
  url: string | null;
  thumbnail: string | null;
  duration: number | null;
  dominant_color: string | null;
}
export interface StoryItem {
  id: number;
  caption: string | null;
  seen: boolean;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  media: StoryMedia[];
}
export interface StoryAuthor {
  id: number;
  name: string;
  username: string;
  avatar: string | null;
}
export interface StoryGroup {
  author: StoryAuthor;
  has_unseen: boolean;
  stories: StoryItem[];
}

function parseMedia(raw: unknown): StoryMedia | null {
  const r = rec(raw);
  if (typeof r.id !== "number") return null;
  return {
    id: r.id,
    type: str(r.type) ?? "image",
    url: mediaUrl(str(r.url)),
    thumbnail: mediaUrl(str(r.thumbnail)),
    duration: typeof r.duration === "number" ? r.duration : null,
    dominant_color: str(r.dominant_color),
  };
}

function parseStory(raw: unknown): StoryItem | null {
  const r = rec(raw);
  if (typeof r.id !== "number") return null;
  return {
    id: r.id,
    caption: str(r.caption),
    seen: bool(r.seen),
    created_at: str(r.created_at) ?? "",
    likes_count: typeof r.likes_count === "number" ? r.likes_count : 0,
    is_liked: r.is_liked === true,
    media: (Array.isArray(r.media) ? r.media : []).map(parseMedia).filter((m): m is StoryMedia => m !== null),
  };
}

function parseGroup(raw: unknown): StoryGroup | null {
  const r = rec(raw);
  const a = rec(r.author);
  if (typeof a.id !== "number") return null;
  const stories = (Array.isArray(r.stories) ? r.stories : [])
    .map(parseStory)
    .filter((s): s is StoryItem => s !== null);
  if (stories.length === 0) return null;
  return {
    author: {
      id: a.id,
      name: str(a.name) ?? "",
      username: str(a.username) ?? "",
      avatar: mediaUrl(str(a.avatar)),
    },
    has_unseen: typeof r.has_unseen === "boolean" ? r.has_unseen : stories.some((s) => !s.seen),
    stories,
  };
}

// The frame a group is represented by: first unseen story, else the first one (as in inbox_stories_row.dart).
export function coverOfGroup(g: StoryGroup): { url: string | null; color: string | null } {
  const s = g.stories.find((x) => !x.seen) ?? g.stories[0];
  const m = s?.media[0];
  if (!m || m.type === "audio") return { url: null, color: null };
  const url = m.type === "video" ? m.thumbnail : (m.thumbnail ?? m.url);
  const c = m.dominant_color?.trim() ?? "";
  const color = /^#?[0-9a-f]{6}$/i.test(c) ? (c.startsWith("#") ? c : `#${c}`) : null;
  return { url, color };
}

export const storiesApi = {
  list: async (signal?: AbortSignal): Promise<StoryGroup[]> => {
    const raw = await api.get<unknown>("stories-index", undefined, signal);
    return listOf(raw, ["stories", "data"])
      .map(parseGroup)
      .filter((g): g is StoryGroup => g !== null);
  },
  view: (id: number) => api.post<unknown>(`stories-view/${id}`, {}),
  // Stories have no comments server-side; replying lands in the author's DMs (stories-reply).
  reply: (id: number, message: string) =>
    api.post<{ conversation_id: number; message_id: number }>(`stories-reply/${id}`, { message }),
  // Story reshare: copies someone's live story into your own story (same files, nothing re-uploaded).
  reshare: (id: number) =>
    api.post<{ story_id?: number; duplicate?: boolean; message?: string }>(`posts-add-to-story/${id}`, {}),
};
