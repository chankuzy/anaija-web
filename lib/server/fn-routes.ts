// Maps legacy per-endpoint function names to consolidated domain functions.
// One block per migrated domain. Keys are what clients call today (/api/fn/<key>/...).
// A Map (not an object) so names like "constructor" can never resolve to a prototype member.
const FN_ROUTES = new Map<string, string>([
  // comments
  ["comments-list", "comments/list"],
  ["comments-replies", "comments/replies"],
  ["comments-store", "comments/store"],
  ["comments-like", "comments/like"],
  ["comments-destroy", "comments/destroy"],
  ["comments-locate", "comments/locate"],

  // posts
  ["posts-store", "posts/store"],
  ["posts-show", "posts/show"],
  ["posts-update", "posts/update"],
  ["posts-destroy", "posts/destroy"],
  ["posts-like", "posts/like"],
  ["posts-bookmark", "posts/bookmark"],
  ["posts-repost", "posts/repost"],
  ["posts-pin", "posts/pin"],
  ["posts-view", "posts/view"],
  ["posts-share", "posts/share"],
  ["posts-add-to-story", "posts/add-to-story"],
  ["posts-liked", "posts/liked"],
  ["bookmarks-list", "posts/bookmarks"],

  // users
  ["users-show", "users/show"],
  ["users-posts", "users/posts"],
  ["users-listings", "users/listings"],
  ["users-reposts", "users/reposts"],
  ["users-stories", "users/stories"],
  ["users-followers", "users/followers"],
  ["users-following", "users/following"],
  ["users-follow", "users/follow"],
  ["users-block", "users/block"],
  ["blocks-list", "users/blocks"],
  ["username-check", "users/username-check"],
  ["profile-get", "users/me"],
  ["profile-update", "users/me/update"],
  ["profile-complete", "users/me/complete"],
  ["profile-avatar", "users/me/avatar"],
  ["profile-cover", "users/me/cover"],
  ["user-highlights", "users/highlights"],
  ["user-highlights-store", "users/highlights-store"],
  ["user-highlight-posts", "users/highlight-posts"],

  // conversations (messages-* are message-level routes inside the same function)
  ["conversations-inbox", "conversations/inbox"],
  ["conversations-open", "conversations/open"],
  ["conversations-messages", "conversations/messages"],
  ["conversations-send", "conversations/send"],
  ["conversations-info", "conversations/info"],
  ["conversations-mute", "conversations/mute"],
  ["conversations-respond", "conversations/respond"],
  ["conversations-clear", "conversations/clear"],
  ["messages-update", "conversations/message-update"],
  ["messages-destroy", "conversations/message-destroy"],
  ["messages-react", "conversations/message-react"],
  ["messages-read", "conversations/message-read"],
]);

/** ["comments-list", "12"] -> "comments/list/12". Unmapped names pass through untouched. */
export function resolveFn(path: string[]): string {
  const [head, ...rest] = path;
  return [FN_ROUTES.get(head) ?? head, ...rest].join("/");
}
