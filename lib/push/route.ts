// Where a notification tap or in-app banner leads. Mirrors routeFor() in public/sw.js and the Flutter NotificationRouter.
export const PANEL_URL = "/?panel=notifications";

const num = (v: unknown) => (/^\d{1,12}$/.test(String(v ?? "")) ? String(v) : null);
const uname = (v: unknown) => (/^[A-Za-z0-9_.]{2,30}$/.test(String(v ?? "")) ? String(v) : null);
const slugOf = (v: unknown) => (/^[a-z0-9][a-z0-9-]{0,60}$/.test(String(v ?? "")) ? String(v) : null);
const COMMUNITY_TABS = ["overview", "materials", "posts", "about"];

export function routeForPush(d: Record<string, string | undefined>): string {
  const post = num(d.post_id);
  const comment = num(d.comment_id);
  const conv = num(d.conversation_id);
  const user = uname(d.username || d.actor_username);
  const viewer = uname(d.viewer_username);
  const slug = slugOf(d.slug);
  const tab = d.tab && COMMUNITY_TABS.includes(d.tab) ? d.tab : null;
  switch (d.dest) {
    case "post":
      if (post) return `/p/${post}`;
      break;
    case "comment":
      // The post opens with the comment sheet already on that comment.
      if (post) return `/p/${post}${comment ? `?comment=${comment}` : ""}`;
      break;
    case "listing":
      if (post) return `/l/${post}`;
      break;
    case "profile":
      if (user) return `/u/${user}`;
      break;
    case "followers":
      if (viewer) return `/u/${viewer}/followers`;
      break;
    case "conversation":
      if (conv) return `/messages/${conv}`;
      break;
    case "community":
      if (slug) return `/c/${slug}${tab ? `?tab=${tab}` : ""}`;
      break;
    case "chats":
      return "/messages";
  }
  return PANEL_URL;
}
