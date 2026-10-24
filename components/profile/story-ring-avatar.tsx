"use client";

import { Avatar } from "@/components/ui/avatar";
import type { StoryRingState } from "@/lib/stories/use-story-ring";

export type { StoryRingState };

// Ring around the avatar (TikTok-style, Anaija colours from story_ring.dart: accentWarm -> accent,
// 2.5 stroke, 2.5 gap). unseen = warm gradient + glow, seen = muted grey, none = faint grey.
// Same footprint in every state, so nothing shifts when a story gets watched.
const STROKE = 2.5;
const GAP = 2.5;

const RING_BG: Record<StoryRingState, string> = {
  unseen: "linear-gradient(135deg, #ffd84d, #ffca28)",
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
      className="inline-grid shrink-0 place-items-center rounded-full transition-[background] duration-200"
      style={{
        width: outer,
        height: outer,
        padding: STROKE,
        background: RING_BG[ring],
      }}
    >
      <span className="grid place-items-center rounded-full bg-black" style={{ padding: GAP }}>
        <Avatar url={url} name={name} size={size} />
      </span>
    </span>
  );
}
