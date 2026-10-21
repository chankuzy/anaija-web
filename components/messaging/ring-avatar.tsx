import { Avatar } from "@/components/ui/avatar";

// Port of StoryRingAvatar: gold -> jade ring only while something is unwatched; same footprint either way.
const STROKE = 2.5;
const GAP = 2.5;
export const ringOuter = (size: number) => size + (STROKE + GAP) * 2;

export function RingFrame({ size, ring, children }: { size: number; ring: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 rounded-full"
      style={{
        width: ringOuter(size),
        height: ringOuter(size),
        padding: STROKE,
        background: ring ? "linear-gradient(135deg, var(--color-warm), var(--color-accent))" : undefined,
      }}
    >
      <span className="flex size-full items-center justify-center rounded-full bg-bg" style={{ padding: GAP }}>
        {children}
      </span>
    </span>
  );
}

export function RingAvatar({
  url,
  name,
  size,
  ring,
}: {
  url?: string | null;
  name?: string | null;
  size: number;
  ring: boolean;
}) {
  return (
    <RingFrame size={size} ring={ring}>
      <Avatar url={url} name={name} size={size} />
    </RingFrame>
  );
}
