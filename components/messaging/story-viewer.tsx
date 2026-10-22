/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayback } from "@/components/feed/playback-context";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { storiesApi, type StoryGroup, type StoryItem } from "@/lib/api/stories";
import { timeAgo } from "@/lib/format";

const IMAGE_MS = 5000;
// StoryMedia.duration is whole seconds in the Flutter model; tolerate milliseconds too.
const durMs = (d: number | null | undefined, fallback: number) =>
  d && d > 0 ? (d > 1000 ? d : d * 1000) : fallback;

function Slide({
  group,
  story,
  index,
  paused,
  onDone,
}: {
  group: StoryGroup;
  story: StoryItem;
  index: number;
  paused: boolean;
  onDone: () => void;
}) {
  const m = story.media[0];
  const isVideo = m?.type === "video";
  const url = isVideo ? m?.url : (m?.url ?? m?.thumbnail);
  const ms = isVideo ? durMs(m?.duration, 15000) : IMAGE_MS;
  const ref = useRef<HTMLVideoElement>(null);
  const { muted, forceMute } = usePlayback();

  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (paused) {
      el.pause();
      return;
    }
    const p = el.play();
    if (p)
      p.catch(() => {
        if (el.muted) return;
        el.muted = true;
        forceMute();
        el.play().catch(() => {});
      });
  }, [paused, forceMute]);

  return (
    <>
      <div className="absolute inset-0 grid place-items-center" style={{ backgroundColor: m?.dominant_color ? `#${m.dominant_color.replace("#", "")}` : "#0a0a0a" }}>
        {isVideo && url ? (
          <video ref={ref} src={url} autoPlay muted playsInline onEnded={onDone} className="size-full object-contain" />
        ) : url ? (
          <img src={url} alt="" decoding="async" draggable={false} className="size-full object-contain" />
        ) : (
          <p className="px-8 text-center text-xl font-semibold text-fg">{story.caption}</p>
        )}
      </div>
      <div className="fade-top pointer-events-none absolute inset-x-0 top-0 h-28" />
      {story.caption && url && (
        <>
          <div className="fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-40" />
          <p className="text-shadow absolute inset-x-5 bottom-6 text-body text-white">{story.caption}</p>
        </>
      )}
      <div
        className="pointer-events-none absolute inset-x-3 z-10 flex gap-1"
        style={{ top: "calc(10px + env(safe-area-inset-top))" }}
      >
        {Array.from({ length: group.stories.length }, (_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            {i < index && <div className="h-full w-full bg-white" />}
            {i === index && (
              <div
                className="story-fill h-full bg-white"
                style={{ animationDuration: `${ms}ms`, animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={onDone}
              />
            )}
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute left-3 z-10 flex items-center gap-2.5"
        style={{ top: "calc(26px + env(safe-area-inset-top))" }}
      >
        <Avatar url={group.author.avatar} name={group.author.name} size={34} />
        <span className="text-shadow text-secondary font-semibold text-white">{group.author.name || group.author.username}</span>
        <span className="text-shadow text-supporting text-white/70">{timeAgo(story.created_at)}</span>
      </div>
    </>
  );
}

// Minimal port of StoryViewerScreen: tap right/left to move, hold to pause, Esc to close.
// Works on a snapshot of the groups so the inbox poll never shifts it underneath the viewer.
export function StoryViewer({
  groups,
  start,
  myId,
  onClose,
}: {
  groups: StoryGroup[];
  start: number;
  myId?: number;
  onClose: (seenIds: number[]) => void;
}) {
  const [pos, setPos] = useState(() => ({
    g: start,
    s: Math.max(0, groups[start]?.stories.findIndex((x) => !x.seen) ?? 0),
  }));
  const [paused, setPaused] = useState(false);
  const seen = useRef(new Set<number>());
  const holdAt = useRef(0);
  const group = groups[pos.g];
  const story = group?.stories[pos.s];

  const finish = () => onClose([...seen.current]);
  const next = () => {
    if (!group) return finish();
    if (pos.s + 1 < group.stories.length) setPos({ g: pos.g, s: pos.s + 1 });
    else if (pos.g + 1 < groups.length) setPos({ g: pos.g + 1, s: 0 });
    else finish();
  };
  const prev = () => {
    if (pos.s > 0) setPos({ g: pos.g, s: pos.s - 1 });
    else if (pos.g > 0) setPos({ g: pos.g - 1, s: 0 });
  };

  const actions = useRef({ next, prev, finish });
  useEffect(() => {
    actions.current = { next, prev, finish };
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") actions.current.finish();
      else if (e.key === "ArrowRight") actions.current.next();
      else if (e.key === "ArrowLeft") actions.current.prev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Mark viewed on the server (not your own). The local ring is cleared when the viewer closes.
  useEffect(() => {
    if (!story || !group || group.author.id === myId || seen.current.has(story.id)) return;
    seen.current.add(story.id);
    void storiesApi.view(story.id).catch(() => {});
  }, [story, group, myId]);

  if (!group || !story) return null;

  const hold = {
    onPointerDown: () => {
      holdAt.current = Date.now();
      setPaused(true);
    },
    onPointerUp: () => setPaused(false),
    onPointerLeave: () => setPaused(false),
    onPointerCancel: () => setPaused(false),
  };
  const tap = (direction: "next" | "prev") => () => {
    if (Date.now() - holdAt.current < 220) {
      actions.current[direction]();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/95 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={finish} className="absolute inset-0 cursor-default" />
      <div className="relative h-dvh w-full overflow-hidden bg-black md:h-[min(92dvh,860px)] md:w-[min(calc(92dvh*0.5625),480px)] md:rounded-[22px]">
        <Slide key={`${group.author.id}-${story.id}`} group={group} story={story} index={pos.s} paused={paused} onDone={next} />
        <button type="button" aria-label="Previous" onClick={tap("prev")} {...hold} className="absolute inset-y-16 left-0 z-10 w-[35%]" />
        <button type="button" aria-label="Next" onClick={tap("next")} {...hold} className="absolute inset-y-16 right-0 z-10 w-[65%]" />
        <button
          type="button"
          aria-label="Close"
          onClick={finish}
          className="absolute right-3 z-20 grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
          style={{ top: "calc(20px + env(safe-area-inset-top))" }}
        >
          <Icon name="close" className="size-5" />
        </button>
      </div>
    </div>
  );
}
