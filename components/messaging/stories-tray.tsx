"use client";

import Link from "next/link";
import { StoryRingAvatar, type StoryRingState } from "@/components/profile/story-ring-avatar";
import { Icon } from "@/components/ui/icon";
import type { StoryGroup } from "@/lib/api/stories";

const ringOf = (g: StoryGroup): StoryRingState => (g.has_unseen ? "unseen" : "seen");

function Label({
  children,
  dim = false,
  onDark = false,
  big = false,
}: {
  children: React.ReactNode;
  dim?: boolean;
  onDark?: boolean;
  big?: boolean;
}) {
  const tone = onDark ? `text-shadow ${dim ? "text-white/70" : "text-white"}` : dim ? "text-muted" : "text-fg";
  return <span className={`w-full truncate font-bold ${big ? "text-secondary" : "text-supporting"} ${tone}`}>{children}</span>;
}

// Port of InboxStoriesRow: "Your story" first, then people with unwatched stories, then watched ones.
// Every bubble is the person's avatar inside the story ring (not a frame from their last story).
// onDark: white labels with a shadow, for when the row sits over photos/video.
// size: avatar diameter. usernames: label with @-less username instead of the display name.
export function StoriesTray({
  groups,
  me,
  onOpen,
  onDark = false,
  size = 56,
  usernames = false,
}: {
  groups: StoryGroup[];
  me: { id: number; name: string | null; avatar: string | null } | null;
  onOpen: (list: StoryGroup[], index: number) => void;
  onDark?: boolean;
  size?: number;
  usernames?: boolean;
}) {
  const own = me ? groups.find((g) => g.author.id === me.id) ?? null : null;
  const rest = groups.filter((g) => g.author.id !== me?.id);
  const others = [...rest.filter((g) => g.has_unseen), ...rest.filter((g) => !g.has_unseen)];
  const list = own ? [own, ...others] : others;
  const offset = own ? 1 : 0;
  const myName = me?.name ?? "You";
  const big = size > 60;
  const outer = size + 10; // ring footprint: size + (stroke + gap) * 2
  const btn = "flex flex-col items-center gap-1.5 text-center outline-none transition-transform active:scale-95";
  const btnStyle = { width: outer + 6 };
  const nameOf = (g: StoryGroup) => (usernames ? g.author.username || g.author.name : g.author.name || g.author.username);

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 pt-1">
      {me && (
        <div className="relative shrink-0" style={btnStyle}>
          {own ? (
            <button type="button" onClick={() => onOpen(list, 0)} className={`${btn} w-full`}>
              <StoryRingAvatar url={me.avatar} name={myName} size={size} ring={ringOf(own)} />
              <Label onDark={onDark} big={big}>Your story</Label>
            </button>
          ) : (
            <Link href="/create/new?mode=story" className={`${btn} w-full`}>
              <StoryRingAvatar url={me.avatar} name={myName} size={size} ring="none" />
              <Label onDark={onDark} big={big}>Your story</Label>
            </Link>
          )}
          <Link
            href="/create/new?mode=story"
            aria-label="Add to your story"
            className="absolute grid size-6 place-items-center rounded-full border-2 border-bg bg-brand text-brand-fg transition-transform hover:scale-110 active:scale-95"
            style={{ top: outer - 24, right: 3 }}
          >
            <Icon name="plus" weight="strong" className="size-3.5" />
          </Link>
        </div>
      )}
      {others.map((g, i) => (
        <button key={g.author.id} type="button" onClick={() => onOpen(list, i + offset)} className={`${btn} shrink-0`} style={btnStyle}>
          <StoryRingAvatar url={g.author.avatar} name={g.author.name} size={size} ring={ringOf(g)} />
          <Label dim={!g.has_unseen} onDark={onDark} big={big}>{nameOf(g)}</Label>
        </button>
      ))}
    </div>
  );
}
