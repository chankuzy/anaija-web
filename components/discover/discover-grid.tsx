"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { DiscoverItem } from "@/lib/api/discover";
import { aspectOf } from "@/lib/discover/tile";
import { DiscoverCard, type VideoBadge } from "./discover-card";

// Instagram Explore is a fixed 3-column wall inside a centred column; so is this.
const COLS = 3;

// Each tile goes to the currently shortest column (heights known from aspect ratios), so appending a
// page never moves tiles already placed. Same rule as DiscoverMasonryGrid.
//
// Playback: one random on-screen video plays; hovering a video tile hands playback to it, and
// leaving hands it back. State is only ever changed from observer/pointer handlers.
export function DiscoverGrid({
  items,
  onOpen,
  videoBadge = "play",
}: {
  items: DiscoverItem[];
  onOpen: (index: number) => void;
  videoBadge?: VideoBadge;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [random, setRandom] = useState<string | null>(null);
  const visible = useRef(new Set<string>());
  const randomRef = useRef<string | null>(null);

  const pick = () => {
    const ids = [...visible.current];
    return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
  };

  const onVisible = useCallback((id: string, isVisible: boolean) => {
    if (isVisible) visible.current.add(id);
    else visible.current.delete(id);
    const cur = randomRef.current;
    const next = cur && visible.current.has(cur) ? cur : pick();
    if (next !== cur) {
      randomRef.current = next;
      setRandom(next);
    }
  }, []);

  const playingId = hover ?? random;

  const columns = useMemo(() => {
    const cols: { item: DiscoverItem; index: number }[][] = Array.from({ length: COLS }, () => []);
    const h = new Array<number>(COLS).fill(0);
    items.forEach((item, index) => {
      let k = 0;
      for (let j = 1; j < COLS; j++) if (h[j] < h[k] - 1e-4) k = j;
      cols[k].push({ item, index });
      h[k] += 1 / aspectOf(item);
    });
    return cols;
  }, [items]);

  return (
    <div className="flex gap-[3px] overflow-hidden">
      {columns.map((col, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {col.map(({ item, index }) => (
            <DiscoverCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(index)}
              videoBadge={videoBadge}
              playing={playingId === item.id}
              onVisible={onVisible}
              onHover={setHover}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const RATIOS = [0.78, 1.05, 0.7, 0.95, 0.72, 0.88, 1.0, 0.75, 0.9];

export function DiscoverSkeleton() {
  return (
    <div className="flex gap-[3px] overflow-hidden" aria-hidden="true">
      {Array.from({ length: COLS }, (_, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="animate-pulse bg-card/70"
              style={{ aspectRatio: String(RATIOS[(c * 5 + i) % RATIOS.length]) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
