"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DiscoverItem } from "@/lib/api/discover";
import { aspectOf } from "@/lib/discover/tile";
import { DiscoverCard } from "./discover-card";

// Flutter is fixed at 3 columns; web adapts to the space left of the sidebar.
const subscribe = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const columnsNow = () => (window.innerWidth < 768 ? 3 : window.innerWidth < 1280 ? 4 : 5);
const useColumns = () => useSyncExternalStore(subscribe, columnsNow, () => 3);

// Each tile goes to the currently shortest column (heights known from aspect ratios), so appending a
// page never moves tiles already placed. Same rule as DiscoverMasonryGrid.
export function DiscoverGrid({ items, onOpen }: { items: DiscoverItem[]; onOpen: (index: number) => void }) {
  const n = useColumns();
  const columns = useMemo(() => {
    const cols: { item: DiscoverItem; index: number }[][] = Array.from({ length: n }, () => []);
    const h = new Array<number>(n).fill(0);
    items.forEach((item, index) => {
      let k = 0;
      for (let j = 1; j < n; j++) if (h[j] < h[k] - 1e-4) k = j;
      cols[k].push({ item, index });
      h[k] += 1 / aspectOf(item);
    });
    return cols;
  }, [items, n]);

  return (
    <div className="flex gap-[2px]">
      {columns.map((col, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-[2px]">
          {col.map(({ item, index }) => (
            <DiscoverCard key={item.id} item={item} onOpen={() => onOpen(index)} />
          ))}
        </div>
      ))}
    </div>
  );
}

const RATIOS = [0.78, 1.05, 0.7, 0.95, 0.72, 0.88, 1.0, 0.75, 0.9];

export function DiscoverSkeleton() {
  const n = useColumns();
  return (
    <div className="flex gap-[2px]" aria-hidden="true">
      {Array.from({ length: n }, (_, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-[2px]">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-[3px] bg-card/70"
              style={{ aspectRatio: String(RATIOS[(c * 5 + i) % RATIOS.length]) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
