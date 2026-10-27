import type { Post } from "@/lib/api/feed-types";

// One canonical standalone URL per post. /p/{id} for everything except listings, which keep /l/{id}.
export const postHref = (p: Post) => (p.type === "listing" || p.listing ? `/l/${p.id}` : `/p/${p.id}`);
