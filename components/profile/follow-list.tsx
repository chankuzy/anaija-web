"use client";
import { ProfileHoverCard } from "@/components/profile/profile-hover-card";
import { UserRowsSkeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { usersApi, type FollowUser } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/auth-context";
import { seedFollows, toggleFollow, useIsFollowing } from "@/lib/feed/follow-store";
import { usePaged, type Page } from "@/lib/paged/use-paged";
import { useMyFollowerIds } from "@/lib/profile/use-my-followers";

type Kind = "followers" | "following";

function Row({ u, isSelf, followsMe }: { u: FollowUser; isSelf: boolean; followsMe: boolean }) {
  const following = useIsFollowing(u.id, u.is_following);
  const mutual = following && followsMe;
  const href = u.username ? `/u/${u.username}` : "#";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <ProfileHoverCard username={u.username}><Avatar url={u.avatar} name={u.name ?? u.username} size={46} /></ProfileHoverCard>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-fg">{u.name ?? u.username}</span>
          <span className="block truncate text-xs text-muted">@{u.username}</span>
          {mutual ? (
            <span className="mt-1 inline-block rounded-full border border-white/14 bg-white/8 px-2 py-0.5 text-micro font-bold text-white/85">Mutual</span>
          ) : (
            followsMe && <span className="mt-1 block text-supporting font-medium text-muted">Follows you</span>
          )}
        </span>
      </Link>
      {!isSelf && (
        <button
          type="button"
          onClick={() => void toggleFollow(u.id, following)}
          className={`h-[34px] shrink-0 rounded-full px-4 text-secondary font-bold transition active:scale-[0.96] ${
            following ? "border border-white/28 text-fg" : "bg-white text-black"
          }`}
        >
          {following ? "Following" : followsMe ? "Follow back" : "Follow"}
        </button>
      )}
    </div>
  );
}

export function FollowListView({ username, kind }: { username: string; kind: Kind }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const authed = status === "authed";
  const viewingOwn = user?.username === username;

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  const load = useCallback(
    async (cursor: number | null, signal?: AbortSignal): Promise<Page<FollowUser, number>> => {
      const page = cursor ?? 1;
      const r = await usersApi.followList(kind, username, page, signal);
      seedFollows(r.data);
      return { items: r.data, cursor: r.has_more ? page + 1 : null, hasMore: r.has_more };
    },
    [kind, username],
  );
  const list = usePaged<FollowUser, number>({ id: `${kind}:${username}`, enabled: authed, load });
  const mine = useMyFollowerIds(user?.username, authed);

  const items = list.data?.items ?? [];
  const hasMore = list.data?.hasMore ?? false;
  const loadingMore = list.data?.loadingMore ?? false;
  const moreError = list.data?.moreError ?? false;
  const loadMore = list.loadMore;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadMore(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, hasMore, loadingMore, moreError, loadMore]);

  const seg = (k: Kind, label: string) => (
    <Link
      href={`/u/${username}/${k}`}
      replace
      className={`grid h-[38px] flex-1 place-items-center rounded-full text-body ${
        k === kind ? "border border-white/26 bg-white/15 font-bold text-fg" : "font-medium text-white/60"
      }`}
    >
      {label}
    </Link>
  );

  let body: React.ReactNode;
  if (status !== "authed" || (list.loading && !list.data)) {
    body = <UserRowsSkeleton />;
  } else if (list.data?.error && items.length === 0) {
    body = (
      <div className="py-16 text-center">
        <p className="text-sm text-muted">{list.data.error}</p>
        <button type="button" onClick={list.reload} className="mt-4 text-sm font-bold text-fg">
          Try again
        </button>
      </div>
    );
  } else if (items.length === 0) {
    body = <p className="py-16 text-center text-[15px] font-bold text-fg">{kind === "followers" ? "No followers yet" : "Not following anyone yet"}</p>;
  } else {
    body = (
      <>
        {items.map((u) => (
          <Row key={u.id} u={u} isSelf={user?.id === u.id} followsMe={(viewingOwn && kind === "followers") || mine.has(u.id)} />
        ))}
        <div ref={sentinel} className="h-px" />
        {loadingMore && <UserRowsSkeleton count={2} />}
        {moreError && (
          <button type="button" onClick={() => loadMore(true)} className="mx-auto block py-4 text-xs font-semibold text-muted">
            Couldn&apos;t load more · tap to retry
          </button>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 pb-8">
      <header className="sticky top-0 z-20 bg-bg pb-2" style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3.5 py-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.back()}
            className="grid size-11 place-items-center rounded-full border border-white/12 bg-white/6 text-fg"
          >
            <Icon name="back" className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-fg">@{username}</h1>
        </div>
        <div className="flex gap-0.5 rounded-full border border-white/10 bg-white/5 p-[3px]">
          {seg("followers", "Followers")}
          {seg("following", "Following")}
        </div>
      </header>
      {body}
    </div>
  );
}
