"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetch } from "@/components/community/kit";
import { Avatar } from "@/components/ui/avatar";
import { mediaUrl } from "@/lib/api/feed";
import type { PeopleItem } from "@/lib/api/feed-types";
import { communitiesApi, type Community } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { feedEvents } from "@/lib/feed/event-tracker";
import { toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";

type U = PeopleItem["users"][number];

const ACT = "shrink-0 px-1 text-supporting font-bold transition-colors";

function PersonRow({ u, onOpen, onFollowed }: { u: U; onOpen: (id: number) => void; onFollowed: (id: number) => void }) {
  const following = useIsFollowing(u.id, false);
  const display = u.name || u.username || "";

  async function follow() {
    if (following) return;
    if ((await toggleFollow(u.id, false)) === true) onFollowed(u.id);
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <Link href={u.username ? `/u/${u.username}` : "#"} onClick={() => onOpen(u.id)} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar url={u.avatar} name={display} size={44} />
        <span className="min-w-0">
          <span className="block truncate text-body font-bold text-fg">{u.username ?? display}</span>
          <span className="block truncate text-supporting text-muted">{u.label || display}</span>
        </span>
      </Link>
      <button type="button" disabled={following} onClick={() => void follow()} className={`${ACT} ${following ? "text-muted" : "text-brand hover:text-brand-hover"}`}>
        {following ? "Following" : "Follow"}
      </button>
    </li>
  );
}

function CommunityRow({ c }: { c: Community }) {
  const [joined, setJoined] = useState(c.is_member);
  const [busy, setBusy] = useState(false);
  const meta = `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`;

  async function join() {
    if (busy || joined) return;
    setBusy(true);
    try {
      const r = await communitiesApi.join(c.id);
      if (r.is_member) setJoined(true);
    } catch {
      /* stays "Join"; they can retry or open the community */
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <Link href={`/c/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar url={c.avatar} name={c.name} size={44} />
        <span className="min-w-0">
          <span className="block truncate text-body font-bold text-fg">{c.name}</span>
          <span className="block truncate text-supporting text-muted">{meta}</span>
        </span>
      </Link>
      {joined ? (
        <span className={`${ACT} text-muted`}>Joined</span>
      ) : c.join_policy === "open" ? (
        <button type="button" disabled={busy} onClick={() => void join()} className={`${ACT} text-brand hover:text-brand-hover disabled:opacity-60`}>
          Join
        </button>
      ) : (
        <Link href={`/c/${c.slug}`} className={`${ACT} text-brand hover:text-brand-hover`}>
          View
        </Link>
      )}
    </li>
  );
}

// Desktop right rail (lg+): who you are, people to follow, communities to join, footer. People come from the same
// engine unit the feed already receives (follow / open / impression events keep their contract); communities use
// the existing discover endpoint.
export function HomeRail({
  people,
  sessionId,
  onOpen,
  onFollowed,
}: {
  people: U[];
  sessionId: string | null;
  onOpen: (id: number) => void;
  onFollowed: (id: number) => void;
}) {
  const { user } = useAuth();
  const seen = useRef(new Set<number>());
  useEffect(() => {
    for (const u of people) if (seen.current.add(u.id)) feedEvents.suggestion("suggestion_impression", u.id, sessionId);
  }, [people, sessionId]);

  const disc = useFetch("rail:communities", () => communitiesApi.discover({}), { persist: true });
  const communities = useMemo(() => (disc.data?.items ?? []).filter((c) => !c.is_member).slice(0, 4), [disc.data]);

  return (
    <aside aria-label="Suggestions" className="sticky top-0 hidden h-fit w-[320px] shrink-0 self-start pt-9 lg:block">
      {user && (
        <Link href="/me" className="flex items-center gap-3 pb-5">
          <Avatar url={mediaUrl(user.avatar)} name={user.name ?? user.username} size={48} />
          <span className="min-w-0">
            <span className="block truncate text-body font-bold text-fg">{user.username ?? user.name}</span>
            <span className="block truncate text-body text-muted">{user.name ?? ""}</span>
          </span>
        </Link>
      )}

      {people.length > 0 && (
        <section aria-label="Suggested for you">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-body font-bold text-muted">Suggested for you</h2>
            <Link href="/discover" className="text-supporting font-bold text-fg hover:text-muted">
              See all
            </Link>
          </div>
          <ul>
            {people.map((u) => (
              <PersonRow key={u.id} u={u} onOpen={onOpen} onFollowed={onFollowed} />
            ))}
          </ul>
        </section>
      )}

      {communities.length > 0 && (
        <section aria-label="Communities for you" className="mt-5">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-body font-bold text-muted">Communities for you</h2>
            <Link href="/communities" className="text-supporting font-bold text-fg hover:text-muted">
              See all
            </Link>
          </div>
          <ul>
            {communities.map((c) => (
              <CommunityRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Footer" className="mt-8 flex flex-wrap gap-x-2 text-micro text-muted/70">
        <Link href="/settings/help" className="hover:text-muted">Help</Link>
        <span aria-hidden>·</span>
        <Link href="/settings/report" className="hover:text-muted">Report a problem</Link>
        <span aria-hidden>·</span>
        <Link href="/settings" className="hover:text-muted">Settings</Link>
      </nav>
      <p className="mt-3 text-micro uppercase text-muted/60">© 2026 Anaija</p>
    </aside>
  );
}
