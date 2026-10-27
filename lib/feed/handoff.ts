import type { Post } from "@/lib/api/feed-types";

// Home -> Immersive: the post being opened is staged here so /watch can show it instantly, with the same identity.
// Engagement state is not copied: FeedCard overlays the viewer's own actions from the shared interactions store.
let staged: Post | null = null;

export const stageForImmersive = (p: Post) => {
  staged = p;
};
export const stagedForImmersive = (id: number): Post | null => (staged?.id === id ? staged : null);
export const immersiveHref = (id: number) => `/watch?post=${id}`;
