/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { coverOfGroup, type StoryGroup } from "@/lib/api/stories";
import { RingFrame } from "./ring-avatar";

const SIZE = 56;
const BTN = "flex w-[66px] flex-col items-center gap-1.5 text-center outline-none";

function Cover({ group, avatar, name }: { group: StoryGroup | null; avatar: string | null; name: string }) {
  const cover = group ? coverOfGroup(group) : { url: null, color: null };
  if (!cover.url) return <Avatar url={avatar} name={name} size={SIZE} />;
  return (
    <span className="block overflow-hidden rounded-full" style={{ width: SIZE, height: SIZE, backgroundColor: cover.color ?? undefined }}>
      <img src={cover.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
    </span>
  );
}

function Label({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return <span className={`w-full truncate text-supporting font-medium ${dim ? "text-muted" : "text-fg"}`}>{children}</span>;
}

// Port of InboxStoriesRow: "Your story" first, then people with unwatched stories, then watched ones.
export function StoriesTray({
  groups,
  me,
  onOpen,
}: {
  groups: StoryGroup[];
  me: { id: number; name: string | null; avatar: string | null } | null;
  onOpen: (list: StoryGroup[], index: number) => void;
}) {
  const own = me ? groups.find((g) => g.author.id === me.id) ?? null : null;
  const rest = groups.filter((g) => g.author.id !== me?.id);
  const others = [...rest.filter((g) => g.has_unseen), ...rest.filter((g) => !g.has_unseen)];
  const list = own ? [own, ...others] : others;
  const offset = own ? 1 : 0;
  const myName = me?.name ?? "You";

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 pt-1">
      {me && (
        <div className="relative shrink-0">
          {own ? (
            <button type="button" onClick={() => onOpen(list, 0)} className={BTN}>
              <RingFrame size={SIZE} ring={false}>
                <Cover group={own} avatar={me.avatar} name={myName} />
              </RingFrame>
              <Label>Your story</Label>
            </button>
          ) : (
            <Link href="/create/new" className={BTN}>
              <RingFrame size={SIZE} ring={false}>
                <Avatar url={me.avatar} name={myName} size={SIZE} />
              </RingFrame>
              <Label>Your story</Label>
            </Link>
          )}
          <Link
            href="/create/new"
            aria-label="Add to your story"
            className="absolute right-0 top-[42px] grid size-6 place-items-center rounded-full border-2 border-bg bg-white text-black"
          >
            <Icon name="plus" weight="strong" className="size-3.5" />
          </Link>
        </div>
      )}
      {others.map((g, i) => (
        <button key={g.author.id} type="button" onClick={() => onOpen(list, i + offset)} className={`${BTN} shrink-0`}>
          <RingFrame size={SIZE} ring={g.has_unseen}>
            <Cover group={g} avatar={g.author.avatar} name={g.author.name} />
          </RingFrame>
          <Label dim={!g.has_unseen}>{g.author.name || g.author.username}</Label>
        </button>
      ))}
    </div>
  );
}
