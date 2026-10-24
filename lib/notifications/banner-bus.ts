import type { ActivityItem } from "@/lib/api/activity";

export type Banner = {
  key: string; // same key = update in place instead of stacking
  source: "push" | "poll"; // push = rich payload from the service worker, poll = in-app inbox/activity diff
  title: string;
  body?: string | null;
  avatar?: string | null;
  image?: string | null; // post / listing thumbnail
  kind?: string; // activity kind, "message", or a share kind (reel | post | listing | story)
  video?: boolean;
  chat?: boolean; // a conversation notification
  href?: string | null; // push: precomputed route
  conv?: number; // poll: conversation id
  act?: ActivityItem; // poll: activity item (the banner resolves its destination)
};

type Fn = (b: Banner) => void;
const subs = new Set<Fn>();

export const emitBanner = (b: Banner) => subs.forEach((fn) => fn(b));
export function onBanner(fn: Fn): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
