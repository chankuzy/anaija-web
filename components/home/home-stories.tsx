"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMessages } from "@/components/messaging/messages-context";
import { StoriesTray } from "@/components/messaging/stories-tray";
import { StoryViewer } from "@/components/messaging/story-viewer";
import { mediaUrl } from "@/lib/api/feed";
import type { StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { feedEvents } from "@/lib/feed/event-tracker";
import { holdMedia, releaseMedia } from "@/lib/feed/media-hold";
import { useMedia } from "@/lib/ui/use-media";

// Same story data and viewer as the immersive feed; here it is a plain row in the page flow.
// Anaija colours and avatars, Instagram proportions: avatar 78 (ring footprint 88) on phones and desktop alike.
const AVATAR_MOBILE = 78;
const AVATAR_DESKTOP = 78;

export function HomeStories() {
  const { status, user } = useAuth();
  const { groups, markStoriesSeen } = useMessages();
  const desktop = useMedia("(min-width: 768px)");
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const open = viewer !== null;

  // While the viewer is open nothing underneath plays or counts dwell time.
  useEffect(() => {
    if (!open) return;
    holdMedia("story");
    feedEvents.hold("story");
    return () => {
      releaseMedia("story");
      feedEvents.release("story");
    };
  }, [open]);

  if (status !== "authed" || !user) return null;
  const me = { id: user.id, name: user.name, avatar: mediaUrl(user.avatar) };

  return (
    <>
      {/* The tray carries its own 16px side padding; on desktop it is pulled back so the first ring lines up with the posts. */}
      <div className="pb-3 pt-1 md:-mx-4 md:pb-6 md:pt-8">
        <StoriesTray
          groups={groups}
          me={me}
          onDark
          size={desktop ? AVATAR_DESKTOP : AVATAR_MOBILE}
          usernames
          onOpen={(g, i) => setViewer({ groups: g, start: i })}
        />
      </div>
      {viewer &&
        createPortal(
          <StoryViewer
            groups={viewer.groups}
            start={viewer.start}
            myId={user.id}
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
