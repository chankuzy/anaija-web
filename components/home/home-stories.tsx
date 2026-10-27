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

// Same story data and viewer as the immersive feed; here it is a plain row in the page flow.
export function HomeStories() {
  const { status, user } = useAuth();
  const { groups, markStoriesSeen } = useMessages();
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
      <div className="px-4 pb-4 pt-1 md:px-0">
        <StoriesTray groups={groups} me={me} onDark size={64} usernames onOpen={(g, i) => setViewer({ groups: g, start: i })} />
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
