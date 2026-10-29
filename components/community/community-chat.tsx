"use client";

import Link from "next/link";
import { ThreadPane } from "@/components/messaging/thread-pane";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/next";
import { typingLabel, useTyping } from "@/lib/messaging/use-typing";
import { Empty, useFetch } from "./kit";
import { useLockScroll, useViewport } from "@/lib/ui/use-visual-viewport";

export function CommunityChat({ slug }: { slug: string }) {
  const { status, user } = useAuth();
  const vp = useViewport();
  useLockScroll();
  const det = useFetch(status === "loading" ? null : `c:${slug}:${status}`, () => communitiesApi.show(slug));
  const c = det.data;
  const room = useTyping(c?.chat_conversation_id ?? 0, c?.chat_conversation_id ? user?.id : undefined, user?.name);

  const shell = {
    "--vvh": vp ? `${vp.h}px` : "100dvh",
    "--vvt": vp ? `${vp.t}px` : "0px",
  } as React.CSSProperties;
  const frame =
    "fixed inset-x-0 top-[var(--vvt)] z-[60] flex h-[var(--vvh)] flex-col bg-bg " +
    "md:static md:z-auto md:mx-auto md:my-4 md:h-[calc(100dvh-32px)] md:max-w-[860px] md:overflow-hidden md:rounded-[22px] md:bg-surface-subtle";

  let body: React.ReactNode;
  if (!c) {
    body = det.error ? (
      <div className="p-4">
        <Empty title="Chat isn't available" body={det.error}>
          <Link href={`/c/${slug}`} className={buttonClass("primary", "h-10 px-5")}>Back to community</Link>
        </Empty>
      </div>
    ) : (
      <div role="status" aria-busy="true" aria-label="Loading chat" className="space-y-3 p-4">
        <Sk className="h-9 w-2/3 rounded-[18px]" />
        <Sk className="ml-auto h-9 w-1/2 rounded-[18px]" />
        <Sk className="h-9 w-3/5 rounded-[18px]" />
      </div>
    );
  } else if (status !== "authed") {
    body = (
      <div className="p-4">
        <Empty title="Sign in to chat" body="Chat is for community members.">
          <Link href={loginHref()} className={buttonClass("primary", "h-10 px-5")}>Sign in</Link>
        </Empty>
      </div>
    );
  } else if (!c.is_member) {
    body = (
      <div className="p-4">
        <Empty title="Chat is for members" body="Join this community to talk with everyone in real time.">
          <Link href={`/c/${slug}`} className={buttonClass("primary", "h-10 px-5")}>Go to community</Link>
        </Empty>
      </div>
    );
  } else if (!c.chat_conversation_id) {
    body = (
      <div className="p-4">
        <Empty title="Chat isn't available" body="This community's chat couldn't be found." />
      </div>
    );
  } else {
    body = (
      <div className="min-h-0 flex-1">
        <ThreadPane conversationId={c.chat_conversation_id} embedded communityDetail={c} />
      </div>
    );
  }

  return (
    <div className={frame} style={shell}>
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-2.5 pt-2.5"
        style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
      >
        <Link
          href={`/c/${slug}`}
          aria-label="Back to community"
          className="grid size-10 place-items-center rounded-full text-fg transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon name="back" className="size-6" />
        </Link>
        {c ? (
          <Link href={`/c/${slug}`} className="flex min-w-0 items-center gap-3">
            <Avatar url={c.avatar} name={c.name} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold text-fg">{c.name}</span>
              <span className="block truncate text-supporting text-muted">
                {room.typing ? typingLabel(room.names, false) : `${c.members_count} ${c.members_count === 1 ? "member" : "members"}`}
              </span>
            </span>
          </Link>
        ) : (
          <>
            <Sk className="size-9 rounded-full" />
            <Sk className="h-4 w-32 rounded-full" />
          </>
        )}
      </header>
      {body}
    </div>
  );
}
