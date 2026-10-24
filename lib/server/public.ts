import { cacheLife, cacheTag } from "next/cache";
import { callFunction } from "@/lib/server/upstream";
import { normPost } from "@/lib/api/feed";
import type { Post } from "@/lib/api/feed-types";

export interface PublicTile {
  id: number;
  type: string;
  thumbnail: string | null;
}
export interface PublicProfile {
  id: number;
  name: string | null;
  username: string;
  bio: string | null;
  tagline: string | null;
  avatar: string | null;
  cover: string | null;
  is_verified: boolean;
  campus_verified: boolean;
  institution: string | null;
  counts: { posts: number; listings: number; followers: number };
  tiles: PublicTile[];
}

// Cached reads shared by generateMetadata and the page, so one request hits upstream once.
// 404 -> null (cached); any other failure throws, so a transient error is never cached as "gone".
async function fetchPost(id: number): Promise<Post | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(`public-post:${id}`);
  const res = await callFunction(`public-post/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`public-post ${res.status}`);
  return normPost((await res.json()) as Post);
}

async function fetchProfile(username: string): Promise<PublicProfile | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(`public-profile:${username.toLowerCase()}`);
  const res = await callFunction(`public-profile/${encodeURIComponent(username)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`public-profile ${res.status}`);
  return (await res.json()) as PublicProfile;
}

/** Post | null (gone / not public) | undefined (couldn't load right now). */
export async function getPublicPost(id: number): Promise<Post | null | undefined> {
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    return await fetchPost(id);
  } catch {
    return undefined;
  }
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null | undefined> {
  if (!/^[\w.]{1,50}$/.test(username)) return null;
  try {
    return await fetchProfile(username);
  } catch {
    return undefined;
  }
}
