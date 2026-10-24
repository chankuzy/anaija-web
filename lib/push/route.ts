// Where a notification tap or in-app banner leads. Mirrors routeFor() in public/sw.js and the Flutter NotificationRouter.
export const PANEL_URL = "/?panel=notifications";

const num = (v: unknown) => (/^\d{1,12}$/.test(String(v ?? "")) ? String(v) : null);
const uname = (v: unknown) => (/^[A-Za-z0-9_.]{2,30}$/.test(String(v ?? "")) ? String(v) : null);

export function routeForPush(d: Record<string, string | undefined>): string {
  const post = num(d.post_id);
  const conv = num(d.conversation_id);
  const user = uname(d.username || d.actor_username);
  const viewer = uname(d.viewer_username);
  switch (d.dest) {
    case "post":
    case "comment":
      if (post) return `/p/${post}`;
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
    case "chats":
      return "/messages";
  }
  return PANEL_URL;
}
