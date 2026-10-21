"use client";

import { Avatar } from "@/components/ui/avatar";

// Port of story_ring_avatar.dart. The ring exists ONLY while there is something unwatched
// ("unseen"); "seen" and "none" draw a plain black separator. Same footprint in every state so
// nothing shifts when a story gets watched. Gradient + thickness mirror story_ring.dart
// (accentWarm -> accent, 2.5 stroke, 2.5 gap).
export type StoryRingState = "none" | "unseen" | "seen";

const STROKE = 2.5;
const GAP = 2.5;

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
        background: ring === "unseen" ? "linear-gradient(135deg, var(--color-warm), var(--color-accent))" : "#000",
      }}
    >
      <span className="grid place-items-center rounded-full bg-black" style={{ padding: GAP }}>
        <Avatar url={url} name={name} size={size} />
      </span>
    </span>
  );
}
