import type { ActivityDest, ActivityItem } from "@/lib/api/activity";

// One place that decides where a notification leads. Destinations come from the server
// (activityCopy.ts); this turns them into something the web app can do.
export type Target =
  | { type: "url"; url: string }
  | { type: "conversation"; id: number }
  | { type: "posts_list"; itemId: number }
  | { type: "story"; storyId: number }
  | { type: "toast"; message: string }
  | { type: "none" };

const profileUrl = (u: string) => `/u/${encodeURIComponent(u)}`;

// null = the destination is missing data or isn't understood, so the caller falls back.
function direct(it: ActivityItem, d: ActivityDest, me?: string | null): Target | null {
  switch (d.kind) {
    case "post":
      return d.post_id ? { type: "url", url: `/p/${d.post_id}` } : null;
    case "comment":
      // The post opens with the comment sheet already on that comment.
      return d.post_id ? { type: "url", url: `/p/${d.post_id}${d.comment_id ? `?comment=${d.comment_id}` : ""}` } : null;
    case "listing":
      // Sellers asking "who's interested" land on the inquiries section.
      return d.post_id ? { type: "url", url: `/l/${d.post_id}${it.kind === "inquiry" ? "#inquiries" : ""}` } : null;
    case "profile":
      return d.username ? { type: "url", url: profileUrl(d.username) } : null;
    case "followers":
      return me ? { type: "url", url: `${profileUrl(me)}/followers` } : null;
    case "conversation":
      return d.conversation_id ? { type: "conversation", id: d.conversation_id } : null;
    case "chats":
      return { type: "url", url: "/messages" };
    case "posts_list":
      return d.item_id ? { type: "posts_list", itemId: d.item_id } : null;
    case "story":
      return d.post_id ? { type: "story", storyId: d.post_id } : null;
    case "story_summary":
      return { type: "toast", message: "This story has expired" };
    case "community":
      return d.slug ? { type: "url", url: `/c/${encodeURIComponent(d.slug)}${d.tab ? `?tab=${d.tab}` : ""}` } : null;
    case "session":
      return d.code ? { type: "url", url: `/s/${encodeURIComponent(d.code)}` } : null;
    case "none":
      return { type: "none" };
    default:
      return null;
  }
}

// `d` is the destination being followed: the row's own, or the thumbnail's `content`.
export function resolveTarget(it: ActivityItem, d: ActivityDest | null | undefined, me?: string | null): Target {
  const t = direct(it, d ?? it.destination, me);
  if (t) return t;
  const actor = it.actors[0]?.username;
  if (actor) return { type: "url", url: profileUrl(actor) };
  return { type: "toast", message: "Can't open this right now" };
}
