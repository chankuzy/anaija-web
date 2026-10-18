"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { FollowPill } from "@/components/ui/follow-pill";
import { Icon } from "@/components/ui/icon";
import type { PeopleItem } from "@/lib/api/feed-types";
import { useAuth } from "@/lib/auth/auth-context";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";

type U = PeopleItem["users"][number];

function Row({
  u,
  onOpen,
  onFollowed,
  onDismiss,
}: {
  u: U;
  onOpen: (id: number) => void;
  onFollowed: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const router = useRouter();
  const { status } = useAuth();
  const following = useIsFollowing(u.id, false);

  async function follow() {
    if (status !== "authed") {
      router.push("/login");
      return;
    }
    if (following) return;
    const r = await toggleFollow(u.id, false);
    if (r === true) onFollowed(u.id);
  }

  const display = u.name || u.username || "";
  return (
    <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/7 py-3 pl-3 pr-1.5">
      <Link
        href={u.username ? `/u/${u.username}` : "#"}
        onClick={() => onOpen(u.id)}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar url={u.avatar} name={display} size={56} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-white">{display}</span>
          <span className="block truncate text-[12.5px] text-white/65">@{u.username}</span>
          {u.label && <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-white/50">{u.label}</span>}
          {u.tagline?.trim() && <span className="mt-0.5 line-clamp-2 block text-xs text-white/80">{u.tagline.trim()}</span>}
        </span>
      </Link>
      <FollowPill following={following} onClick={() => void follow()} />
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(u.id)} className="grid size-9 place-items-center text-white/55">
        <Icon name="close" className="size-[18px]" />
      </button>
    </div>
  );
}

// Port of _PeopleUnitPage. A headline is only claimed when every person shares the same proven label.
export function PeopleUnit({
  item,
  index,
  onActivate,
  onOpen,
  onFollowed,
  onDismiss,
}: {
  item: PeopleItem;
  index: number;
  onActivate: (i: number) => void;
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
        if (es[0]?.isIntersecting) onActivate(index);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index, onActivate]);

  const labels = new Set(item.users.map((u) => u.label));
  const only = labels.size === 1 ? [...labels][0] : null;
  const title = only ?? "Meet some people";

  return (
    <section ref={ref} className="relative flex h-dvh snap-start snap-always items-center justify-center">
      <div className="feed-card no-scrollbar relative flex flex-col overflow-y-auto bg-[linear-gradient(to_bottom,#111,#000)] px-5 pb-8 pt-24">
        <div className="my-auto">
          <h2 className="text-center text-[22px] font-extrabold text-white">{title}</h2>
          <p className="mb-6 mt-1.5 text-center text-[12.5px] text-white/60">
            Tap a profile to look around, or keep scrolling
          </p>
          <div className="flex flex-col gap-3.5">
            {item.users.map((u) => (
              <Row key={u.id} u={u} onOpen={onOpen} onFollowed={onFollowed} onDismiss={onDismiss} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
