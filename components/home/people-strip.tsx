"use client";

import { openAuth } from "@/lib/auth/auth-modal";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FollowPill } from "@/components/ui/follow-pill";
import { Icon } from "@/components/ui/icon";
import type { PeopleItem } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";

type U = PeopleItem["users"][number];

function PersonCard({ u, onOpen, onFollowed, onDismiss }: { u: U; onOpen: (id: number) => void; onFollowed: (id: number) => void; onDismiss: (id: number) => void }) {
  const { status } = useAuth();
  const following = useIsFollowing(u.id, false);
  const display = u.name || u.username || "";

  async function follow() {
    if (status !== "authed") return openAuth();
    if (following) return;
    if ((await toggleFollow(u.id, false)) === true) onFollowed(u.id);
  }

  return (
    <div className="relative flex w-[168px] shrink-0 snap-start flex-col items-center rounded-card bg-surface-subtle px-3 pb-4 pt-5 text-center">
      <button type="button" aria-label={`Dismiss ${display}`} onClick={() => onDismiss(u.id)} className="hit-area absolute right-2 top-2 grid size-8 place-items-center text-muted">
        <Icon name="close" className="size-[18px]" />
      </button>
      <Link href={u.username ? `/u/${u.username}` : "#"} onClick={() => onOpen(u.id)} className="flex min-w-0 flex-col items-center">
        <Avatar url={u.avatar} name={display} size={72} />
        <span className="mt-3 block w-full truncate text-body font-bold text-fg">{display}</span>
        <span className="block w-full truncate text-supporting text-muted">@{u.username}</span>
        {u.label && <span className="mt-1 line-clamp-2 block text-micro font-semibold text-text-secondary">{u.label}</span>}
      </Link>
      <FollowPill following={following} onClick={() => void follow()} className="mt-3" />
    </div>
  );
}

// "People worth knowing": the engine's suggestion unit as a swipeable row inside the page flow.
export function PeopleStrip({
  item,
  onSeen,
  onOpen,
  onFollowed,
  onDismiss,
}: {
  item: PeopleItem;
  onSeen: (item: PeopleItem) => void;
  onOpen: (id: number) => void;
  onFollowed: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) onSeen(item);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [item, onSeen]);

  // A headline is only claimed when every person shares the same proven label.
  const labels = new Set(item.users.map((u) => u.label));
  const title = labels.size === 1 ? ([...labels][0] ?? "Meet some people") : "Meet some people";

  return (
    <section ref={ref} aria-label={title} className="pb-8">
      <h2 className="px-4 pb-3 text-label font-bold text-fg md:px-0">{title}</h2>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 md:px-0">
        {item.users.map((u) => (
          <PersonCard key={u.id} u={u} onOpen={onOpen} onFollowed={onFollowed} onDismiss={onDismiss} />
        ))}
      </div>
    </section>
  );
}
