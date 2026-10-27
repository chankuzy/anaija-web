import type { ComponentType } from "react";
import type { Post } from "@/lib/api/feed-types";

export interface BodyProps {
  post: Post;
  index: number;
  /** This reel is the one the viewer is watching (mostly in view). Only reels care. */
  active: boolean;
  /** A sheet is open over the post: media must be silent and still. */
  paused: boolean;
  onOpen: () => void;
  onLike: () => void;
}

export interface Renderer {
  Body: ComponentType<BodyProps>;
  /** Content-specific call to action, drawn under the body. */
  Cta?: ComponentType<{ post: Post }>;
  /** The body already shows the caption/title, so the shared caption line is skipped. */
  ownsCaption?: boolean;
  href: (p: Post) => string;
  /** Runs right before navigating to href (the reel hand-off to Immersive). */
  prepare?: (p: Post) => void;
}
