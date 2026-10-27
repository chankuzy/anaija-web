export type FeedScope = "for_you" | "following" | "campus" | "reels";

export interface FeedMedia {
  id: number;
  type: string;
  url: string | null;
  thumbnail: string | null;
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;
  duration: number | null;
  sort_order: number | null;
  blurhash: string | null;
  dominant_color: string | null;
  optimized: boolean | null;
}

export interface FeedAuthor {
  id: number;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_following: boolean;
}

export interface SlideshowConfig {
  enabled: boolean;
  interval_ms: number;
  transition?: string;
}

export interface PostAudio {
  enabled: boolean;
  name?: string;
  url?: string | null;
  duration_ms?: number | null;
  start_ms?: number;
  playback_duration_ms?: number | null;
}

export interface ListingDetail {
  price: number;
  formatted_price: string;
  currency: string;
  price_type: string;
  condition: string | null;
  status: string;
  business_name?: string | null;
  pickup_info?: string | null;
  location_info?: import("@/lib/location/types").LocationInfo | null;
}

export interface Post {
  id: number;
  type: string; // "post" | "listing"
  subtype: string | null;
  pinned_at: string | null;
  caption: string | null;
  location?: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  views_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_reposted: boolean;
  allow_comments: boolean;
  allow_story_sharing: boolean | null;
  visibility: string | null;
  hashtags: string[];
  created_at: string;
  author: FeedAuthor | null;
  media: FeedMedia[];
  slideshow: SlideshowConfig;
  audio: PostAudio;
  listing_type?: string;
  listing?: ListingDetail | null;
  /** Structured payload (poll / document / article / announcement). See lib/feed/structured.ts. */
  content?: unknown;
}

export interface PostItem {
  type: "post";
  id: string;
  post: Post;
  meta: { src: string | null; slot: number };
}

export interface PeopleItem {
  type: "people_suggestion";
  id: string;
  users: {
    id: number;
    name: string | null;
    username: string | null;
    avatar: string | null;
    is_verified: boolean;
    campus_verified: boolean;
    tagline: string | null;
    reason: string;
    label: string | null;
  }[];
}

export type FeedItem = PostItem | PeopleItem;
export const isPostItem = (i: FeedItem): i is PostItem => i.type === "post";

export interface FeedResponse {
  version: number;
  scope: FeedScope;
  session_id: string;
  items: FeedItem[];
  next_cursor: string | null;
  has_more: boolean;
  caught_up: boolean;
  inventory: string;
  cursor_reset: boolean;
  next_actions?: string[];
}
