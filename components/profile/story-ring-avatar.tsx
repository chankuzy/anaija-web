"use client";

import { Avatar } from "@/components/ui/avatar";
import type { StoryRingState } from "@/lib/stories/use-story-ring";

export type { StoryRingState };

// Ring around the avatar. unseen = Anaija amber -> orange -> warm red sweep with a soft glow, seen = quiet grey,
// none = faint grey. Stroke + gap is 5px in every state, so the footprint (size + 10) never changes and nothing
// shifts when a story gets watched.
const STROKE = 3;
const GAP = 2;

const RING_BG: Record<StoryRingState, string> = {
  unseen: "linear-gradient(45deg, #ffe27a 0%, #ffd84d 28%, #ffad32 58%, #ff7a3d 82%, #ff3b5c 100%)",
  seen: "rgba(255,255,255,0.22)",
  none: "rgba(255,255,255,0.14)",
};

export function StoryRingAvatar({
  url,
  name,
  size,
  ring = "none",
}: {
  url?: string | null;
  name?: string | null;
  size: number;
  ring?: StoryRingState;
}) {
  const outer = size + (STROKE + GAP) * 2;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full transition-[background,box-shadow] duration-200"
      style={{
        width: outer,
        height: outer,
        padding: STROKE,
        background: RING_BG[ring],
        boxShadow: ring === "unseen" ? "0 0 14px rgba(255,173,50,0.28)" : undefined,
      }}
    >
      <span className="grid place-items-center rounded-full bg-black" style={{ padding: GAP }}>
        <Avatar url={url} name={name} size={size} />
      </span>
    </span>
  );
}
