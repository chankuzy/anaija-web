"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMessages } from "@/components/messaging/messages-context";
import { StoriesTray } from "@/components/messaging/stories-tray";
import { StoryViewer } from "@/components/messaging/story-viewer";
import { mediaUrl } from "@/lib/api/feed";
import type { StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { feedEvents } from "@/lib/feed/event-tracker";

type Box = { left: number; width: number; top: number };

// Stories row laid over the top of the first post, aligned to the post's own column (measured, so it follows
// the sidebar, breakpoints and window size). It is absolutely positioned inside the feed scroller, so it scrolls
// away natively with the content and takes no space: snap points, indexes and autoplay are untouched.
// Story data comes from the shared Messages provider (already loaded, live over realtime, one copy app-wide).
export function FeedStories({ onViewerChange }: { onViewerChange: (open: boolean) => void }) {
  const { status, user } = useAuth();
  const { groups, markStoriesSeen } = useMessages();
  const enabled = status === "authed";
  const [box, setBox] = useState<Box | null>(null);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // Find the first post's media column (the largest ~9:16 box inside the first feed entry) and sit on it.
  useEffect(() => {
    const host = hostRef.current;
    const scroller = host?.parentElement;
    if (!host || !scroller) return;
    const measure = () => {
      const sr = scroller.getBoundingClientRect();
      let next: Box | null = null;
      const first = scroller.firstElementChild;
      if (first && first !== host) {
        let area = 0;
        for (const el of first.querySelectorAll<HTMLElement>("*")) {
          const r = el.getBoundingClientRect();
          if (r.width < 200 || r.height < 300) continue;
          const ratio = r.width / r.height;
          if (ratio < 0.5 || ratio > 0.62) continue;
          if (r.width * r.height <= area) continue;
          area = r.width * r.height;
          next = { left: r.left - sr.left + scroller.scrollLeft, width: r.width, top: r.top - sr.top + scroller.scrollTop };
        }
      }
      if (!next) {
        const width = Math.min(420, sr.width);
        next = { left: (sr.width - width) / 2, width, top: 56 };
      }
      const n = next;
      setBox((p) =>
        p && Math.abs(p.left - n.left) < 0.5 && Math.abs(p.width - n.width) < 0.5 && Math.abs(p.top - n.top) < 0.5 ? p : n,
      );
    };
    const raf = requestAnimationFrame(measure);
    const settle = window.setTimeout(measure, 500);
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    if (scroller.firstElementChild && scroller.firstElementChild !== host) ro.observe(scroller.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);

  // While the viewer is open the feed must stop playing and stop counting dwell time.
  const open = viewer !== null;
  useEffect(() => {
    if (!open) return;
    feedEvents.hold("story");
    onViewerChange(true);
    return () => {
      feedEvents.release("story");
      onViewerChange(false);
    };
  }, [open, onViewerChange]);

  const me = user ? { id: user.id, name: user.name, avatar: mediaUrl(user.avatar) } : null;
  if (!enabled || !me) return null;

  return (
    <>
      <div ref={hostRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-0 w-0" />
      {box && (
        <div className="pointer-events-none absolute z-20" style={{ left: box.left, width: box.width, top: box.top }}>
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />
          <div className="sv-rise pointer-events-auto relative pt-3">
            <StoriesTray groups={groups} me={me} onDark size={68} usernames onOpen={(g, i) => setViewer({ groups: g, start: i })} />
          </div>
        </div>
      )}
      {viewer &&
        createPortal(
          <StoryViewer
            groups={viewer.groups}
            start={viewer.start}
            myId={user?.id}
            onClose={(ids) => {
              markStoriesSeen(ids);
              setViewer(null);
            }}
          />,
          document.body,
        )}
    </>
  );
}
