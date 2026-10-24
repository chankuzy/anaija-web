import type { Post } from "@/lib/api/feed-types";

export const postPath = (p: Post) => (p.type === "listing" || p.listing ? `/listing/${p.id}` : `/p/${p.id}`);

export function postLink(p: Post): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
  return `${base}${postPath(p)}`;
}
