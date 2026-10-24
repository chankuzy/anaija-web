"use client";
import { FeedSkeleton } from "@/components/feed/feed-states";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedCard } from "@/components/feed/feed-card";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import type { Post } from "@/lib/api/feed-types";
import { postDetailApi } from "@/lib/api/post-detail";
import { useAuth } from "@/lib/auth/auth-context";
import { onCacheClear, useCached } from "@/lib/cache/swr";

// HTTP status of the last failed load per post (404 gone, 410 expired story, 0 network).
const failures = new Map<string, number>();
onCacheClear(() => failures.clear());

// Target of share links (/p/{id}). Same card as the feed, full screen.
// Signed in: posts-show (viewer flags, cached briefly). Everyone else: `initial`, the public copy the server
// fetched for the page and its link preview (null = not available / not public, undefined = couldn't load).
export function PostPage({ id, initial }: { id: string; initial?: Post | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const cParam = Number(sp.get("comment"));
  const focus = Number.isInteger(cParam) && cParam > 0 ? cParam : undefined;
  const { status } = useAuth();
  const authed = status === "authed";
  const n = Number(id);
  const valid = Number.isInteger(n) && n > 0;
  const k = `post:${n}`;
  const [local, setLocal] = useState<Partial<Post>>({});

  const fetcher = useCallback(async () => {
    try {
      const p = await postDetailApi.get(n);
      failures.delete(k);
      return p;
    } catch (e) {
      failures.set(k, e instanceof ApiError ? e.status : 0);
      throw e;
    }
  }, [n, k]);

  const { data: cached, error, mutate } = useCached<Post>(authed && valid ? k : null, fetcher, { staleMs: 30_000, persist: false });

  const noop = useCallback(() => {}, []);
  const patch = useCallback(
    (_id: number, p: Partial<Post>) => {
      if (authed) mutate((old) => ({ ...old, ...p }));
      else setLocal((o) => ({ ...o, ...p }));
    },
    [authed, mutate],
  );
  const gone = useCallback(() => router.replace("/"), [router]);

  const post: Post | undefined = authed ? cached : initial ? { ...initial, ...local } : undefined;

  let code: number | null = null;
  if (!valid) code = 404;
  else if (authed) code = error && !cached ? (failures.get(k) ?? 0) : null;
  else if (initial === null) code = 404;
  else if (initial === undefined && status === "guest") code = 0;

  let content: React.ReactNode;
  if (code === 404) {
    content = <Msg title="This post isn't available" sub="It may have been deleted or isn't public." />;
  } else if (code === 410) {
    content = <Msg title="This story has expired" />;
  } else if (code !== null) {
    content = <Msg title="Couldn't load this post" sub="Check your connection and try again." />;
  } else if (post) {
    content = <FeedCard key={`${post.id}:${focus ?? ""}`} post={post} index={0} active near commentFocus={focus} onActivate={noop} patch={patch} onRemove={gone} />;
  } else {
    content = <FeedSkeleton />;
  }

  return (
    <div className="fixed inset-0 z-[45] bg-black" style={{ "--nav-h": "0px" } as React.CSSProperties}>
      {content}
      <button
        type="button"
        aria-label="Back"
        onClick={() => (window.history.length > 1 ? router.back() : router.replace("/"))}
        className="absolute left-3 z-10 grid size-10 place-items-center rounded-full border border-white/12 bg-black/40 text-white backdrop-blur"
        style={{ top: "calc(12px + env(safe-area-inset-top))" }}
      >
        <Icon name="back" className="size-5" />
      </button>
    </div>
  );
}

function Msg({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="grid h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-[17px] font-bold text-white">{title}</p>
        {sub && <p className="mt-1.5 text-secondary text-white/60">{sub}</p>}
      </div>
    </div>
  );
}
