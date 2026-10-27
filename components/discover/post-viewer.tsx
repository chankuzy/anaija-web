"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DiscoverItem } from "@/lib/api/discover";
import type { Post } from "@/lib/api/feed-types";
import { FeedCard } from "@/components/feed/feed-card";
import { ScrollArrows } from "@/components/feed/scroll-arrows";
import { Icon } from "@/components/ui/icon";
import { isReelEligible } from "@/lib/feed/content";
import { usePrefetchWindow } from "@/lib/feed/net";

// Immersive viewer for a grid: the tapped post and the rest of the grid's Media-eligible posts, swipeable, full screen.
// Non-media posts never enter it (they open their standalone page). `items` is the whole grid; the tapped index is
// mapped into the filtered list here, so callers do not change.
// Browser Back / Esc / the close button all land on the grid exactly where it was.
export function PostViewer({
  items,
  startIndex,
  onClose,
  onPatch,
  onRemove,
}: {
  items: DiscoverItem[];
  startIndex: number;
  onClose: () => void;
  onPatch: (id: number, p: Partial<Post>) => void;
  onRemove: (id: number) => void;
}) {
  const [init] = useState(() => {
    const tapped = items[startIndex];
    const reels = items.filter((i) => i.kind !== "listing" && isReelEligible(i.post));
    return { posts: reels.map((i) => i.post), start: Math.max(0, reels.findIndex((i) => i.id === tapped?.id)) };
  });
  // The viewer owns its copy so optimistic like/bookmark state is correct even if the grid is a cached snapshot.
  const [posts, setPosts] = useState<Post[]>(init.posts);
  const [active, setActive] = useState(init.start);
  const windowFor = usePrefetchWindow(active);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = init.start * el.clientHeight;
  }, [init.start]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep Next's own history state (__NA) so popping back never triggers a reload.
    if (!history.state?.anaijaViewer) history.pushState({ ...history.state, anaijaViewer: true }, "");
    const onPop = () => closeRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") history.back();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (posts.length === 0) history.back();
  }, [posts.length]);

  const onActivate = useCallback((i: number) => setActive(i), []);
  const patch = useCallback(
    (id: number, p: Partial<Post>) => {
      setPosts((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
      onPatch(id, p);
    },
    [onPatch],
  );
  const remove = useCallback(
    (id: number) => {
      setPosts((prev) => prev.filter((x) => x.id !== id));
      onRemove(id);
    },
    [onRemove],
  );

  return (
    <div
      className="fixed inset-0 z-[45] bg-black"
      role="dialog"
      aria-modal="true"
      style={{ "--nav-h": "0px" } as React.CSSProperties}
    >
      <div
        ref={scrollerRef}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
      >
        {posts.map((p, i) => (
          <FeedCard
            key={p.id}
            post={p}
            index={i}
            active={i === active}
            near={windowFor(i).near}
            warm={windowFor(i).warm}
            onActivate={onActivate}
            patch={patch}
            onRemove={remove}
          />
        ))}
      </div>
      <ScrollArrows scroller={scrollerRef} index={active} count={posts.length} />
      <button
        type="button"
        aria-label="Close"
        onClick={() => history.back()}
        className="absolute left-3 z-10 grid size-10 place-items-center rounded-full bg-black/55 text-white"
        style={{ top: "calc(12px + env(safe-area-inset-top))" }}
      >
        <Icon name="close" className="size-5" />
      </button>
    </div>
  );
}
