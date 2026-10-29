"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { OnlineDot } from "@/components/ui/online-dot";
import { convAvatar, convName, type Conversation } from "@/lib/api/messaging";
import { useProfile } from "@/lib/profile/use-profile";
import { RingAvatar } from "./ring-avatar";

// Read defensively: profile and community payloads are shared with other screens, so this never assumes a shape.
const get = (o: unknown, ...keys: string[]): unknown => {
  const r = (o ?? {}) as Record<string, unknown>;
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};
const text = (o: unknown, ...keys: string[]) => {
  const v = get(o, ...keys);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const count = (o: unknown, ...keys: string[]) => {
  const v = get(o, ...keys);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const wrap = "flex flex-col items-center px-6 pb-6 pt-8 text-center";
const nameCls = "mt-3 max-w-full truncate text-[19px] font-bold tracking-tight text-fg";
const btn =
  "mt-4 inline-flex h-9 items-center rounded-full bg-surface-interactive px-5 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated";

function PersonIntro({
  conv,
  other,
  online,
  ring,
}: {
  conv: Conversation;
  other: NonNullable<Conversation["other_user"]>;
  online: boolean;
  ring: boolean;
}) {
  const name = convName(conv);
  const username = other.username || null;
  const { profile } = useProfile(username ?? "", !!username);
  const followers = profile?.counts?.followers ?? null;
  const following = profile?.counts?.following ?? null;
  const bio = profile?.bio?.trim() || null;
  const youFollow = profile?.is_following === true;
  return (
    <div className={wrap}>
      <span className="relative">
        <RingAvatar url={convAvatar(conv)} name={name} size={84} ring={ring} />
        {online && <OnlineDot size={16} className="absolute bottom-[6px] right-[6px]" />}
      </span>
      <p className={nameCls}>{name}</p>
      {username && <p className="mt-0.5 max-w-full truncate text-secondary text-muted">@{username}</p>}
      {online && <p className="mt-1 text-supporting font-semibold text-[#22c55e]">Online</p>}
      {(followers !== null || following !== null) && (
        <p className="mt-2 text-secondary text-muted">
          {followers !== null && (
            <>
              <span className="font-bold text-fg">{compact(followers)}</span> {followers === 1 ? "follower" : "followers"}
            </>
          )}
          {followers !== null && following !== null && " · "}
          {following !== null && (
            <>
              <span className="font-bold text-fg">{compact(following)}</span> following
            </>
          )}
        </p>
      )}
      {bio && <p className="mt-2 line-clamp-3 max-w-xs text-secondary text-fg/80">{bio}</p>}
      {youFollow && username && <p className="mt-1.5 text-supporting text-muted">You follow @{username}</p>}
      {username && (
        <Link href={`/u/${username}`} className={btn}>
          View profile
        </Link>
      )}
    </div>
  );
}

function CommunityIntro({ community, conv }: { community: object; conv: Conversation | null }) {
  const slug = text(community, "slug");
  const name = text(community, "name", "title") ?? (conv ? convName(conv) : "Community");
  const avatar = text(community, "avatar", "avatar_url") ?? (conv ? convAvatar(conv) : null);
  const members = count(community, "members_count");
  const about = text(community, "description", "about", "bio");
  return (
    <div className={wrap}>
      <Avatar url={avatar} name={name} size={84} />
      <p className={nameCls}>{name}</p>
      <p className="mt-0.5 text-secondary text-muted">
        Community{members !== null ? ` · ${compact(members)} ${members === 1 ? "member" : "members"}` : ""}
      </p>
      {about && <p className="mt-2 line-clamp-3 max-w-xs text-secondary text-fg/80">{about}</p>}
      {slug && (
        <Link href={`/c/${slug}`} className={btn}>
          View community
        </Link>
      )}
    </div>
  );
}

function GroupIntro({ conv }: { conv: Conversation }) {
  const name = convName(conv);
  return (
    <div className={wrap}>
      <Avatar url={convAvatar(conv)} name={name} size={84} />
      <p className={nameCls}>{name}</p>
      <p className="mt-0.5 text-secondary text-muted">Group conversation</p>
    </div>
  );
}

// Shown at the very start of a conversation, above the first message.
export function ChatIntro({
  conv,
  community,
  online,
  ring,
}: {
  conv: Conversation | null;
  community: object | null;
  online: boolean;
  ring: boolean;
}) {
  if (community) return <CommunityIntro community={community} conv={conv} />;
  if (!conv) return null;
  if (conv.other_user && conv.type !== "group") return <PersonIntro conv={conv} other={conv.other_user} online={online} ring={ring} />;
  if (conv.type === "group") return <GroupIntro conv={conv} />;
  return null;
}
