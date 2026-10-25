"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMessages } from "@/components/messaging/messages-context";
import { StoryViewer } from "@/components/messaging/story-viewer";
import type { StoryGroup } from "@/lib/api/stories";
import { useAuth } from "@/lib/auth/auth-context";
import { feedEvents } from "@/lib/feed/event-tracker";

type Host = {
  /** true when that person has a story and the viewer opened */
  openById: (userId: number) => boolean;
  openByUsername: (username: string) => boolean;
};
const Ctx = createContext<Host>({ openById: () => false, openByUsername: () => false });

// Same order as the tray: your story, people with unwatched stories, then watched ones.
function trayOrder(groups: StoryGroup[], me?: number): StoryGroup[] {
  const own = me !== undefined ? groups.find((g) => g.author.id === me) : undefined;
  const rest = groups.filter((g) => g.author.id !== me);
  return [...(own ? [own] : []), ...rest.filter((g) => g.has_unseen), ...rest.filter((g) => !g.has_unseen)];
}

export function StoryHostProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { groups, markStoriesSeen } = useMessages();
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const groupsRef = useRef(groups);
  const meRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    groupsRef.current = groups;
    meRef.current = user?.id;
  });

  const openWhere = useCallback((match: (g: StoryGroup) => boolean) => {
    const list = trayOrder(groupsRef.current, meRef.current);
    const i = list.findIndex(match);
    if (i < 0) return false;
    setViewer({ groups: list, start: i });
    return true;
  }, []);
  const openById = useCallback((id: number) => openWhere((g) => g.author.id === id), [openWhere]);
  const openByUsername = useCallback(
    (u: string) => {
      const l = u.toLowerCase();
      return !!l && openWhere((g) => g.author.username.toLowerCase() === l);
    },
    [openWhere],
  );

  const open = viewer !== null;
  useEffect(() => {
    if (!open) return;
    feedEvents.hold("story");
    return () => feedEvents.release("story");
  }, [open]);

  const value = useMemo(() => ({ openById, openByUsername }), [openById, openByUsername]);
  return (
    <Ctx.Provider value={value}>
      {children}
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
    </Ctx.Provider>
  );
}

export const useStoryHost = () => useContext(Ctx);
export const useOpenStory = () => useContext(Ctx).openById;
