"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedSkeleton } from "@/components/feed/feed-states";
import { FeedView } from "@/components/feed/feed-view";
import { ContentReader } from "@/components/post/content-reader";
import { buttonClass } from "@/components/ui/button";
import type { Post } from "@/lib/api/feed-types";
import { postDetailApi } from "@/lib/api/post-detail";
import { useAuth } from "@/lib/auth/auth-context";
import { useCached } from "@/lib/cache/swr";
import { isReelEligible } from "@/lib/feed/content";
import { structuredOf } from "@/lib/feed/structured";

// Target of share links (/p/{id}), the one canonical URL for every kind (link previews are served from here):
//   listing                                   -> /l/{id}
//   poll / document / publication / announce. -> the reader, even when it carries audio (Media is another way in)
//   plain video, or images + audio            -> immersive Media, pinned on this post
//   everything else                           -> the reader (text and image posts)
// Signed in: posts-show (viewer flags) once it arrives; the public copy `initial` paints instantly meanwhile.
// Guests: `initial` only (null = gone / not public, undefined = couldn't load).
export function SharedLanding({ id, initial }: { id: string; initial?: Post | null }) {
  const sp = useSearchParams();
  const cParam = Number(sp.get("comment"));
  const focus = Number.isInteger(cParam) && cParam > 0 ? cParam : undefined;
  const { status } = useAuth();
  const authed = status === "authed";
  const n = Number(id);
  const valid = Number.isInteger(n) && n > 0;

  const fetcher = useCallback(() => postDetailApi.get(n), [n]);
  const { data: cached, error } = useCached<Post>(authed && valid ? `post:${n}` : null, fetcher, { staleMs: 30_000, persist: false });

  if (status === "loading") return <Loading />;

  const post: Post | null | undefined = !valid ? null : authed ? (cached ?? initial ?? undefined) : initial;

  if (post) {
    if (post.type === "listing") return <ToListing id={id} />;
    if (!structuredOf(post) && isReelEligible(post)) return <FeedView videoOnly pinned={post} pinnedFocus={focus} />;
    return <ContentReader id={id} initial={post} />;
  }
  if (post === null || (authed && error)) return <Msg title="This post isn't available" sub="It may have been deleted or isn't public." />;
  if (!authed) return <Msg title="Couldn't load this post" sub="Check your connection and try again." />;
  return <Loading />;
}

function Loading() {
  return (
    <div className="relative h-dvh">
      <FeedSkeleton />
    </div>
  );
}

// replace, not push: Back from the listing returns to wherever the link was opened from.
function ToListing({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/l/${id}`);
  }, [id, router]);
  return <Loading />;
}

function Msg({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="grid h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-[17px] font-bold text-white">{title}</p>
        <p className="mt-1.5 text-secondary text-white/60">{sub}</p>
        <Link href="/" className={buttonClass("outline", "mt-5 h-11 text-secondary")}>
          Explore Anaija
        </Link>
      </div>
    </div>
  );
}
