"use client";

import type { RefObject } from "react";
import { Icon } from "@/components/ui/icon";

export function ScrollArrows({
  scroller,
  index,
  count,
}: {
  scroller: RefObject<HTMLDivElement | null>;
  index: number;
  count: number;
}) {
  const go = (d: number) => {
    const el = scroller.current;
    if (el) el.scrollBy({ top: d * el.clientHeight, behavior: "smooth" });
  };
  const cls =
    "grid size-12 place-items-center rounded-full bg-white/12 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="absolute right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      <button type="button" aria-label="Previous post" disabled={index <= 0} onClick={() => go(-1)} className={cls}>
        <Icon name="chevronDown" className="size-7 rotate-180" />
      </button>
      <button type="button" aria-label="Next post" disabled={index >= count - 1} onClick={() => go(1)} className={cls}>
        <Icon name="chevronDown" className="size-7" />
      </button>
    </div>
  );
}
