"use client";
import { FeedSkeleton } from "@/components/feed/feed-states";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedCard } from "@/components/feed/feed-card";
import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import type { Post } from "@/lib/api/feed-types";
import { postDetailApi } from "@/lib/api/post-detail";
import { useAuth } from "@/lib/auth/auth-context";

interface Data {
  id: string;
  post: Post | null;
  status: number;
}

// Target of share links (/p/{id}). Same card as the feed, full screen. posts-show needs a signed-in user.
export function PostPage({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const cParam = Number(sp.get("comment"));
  const focus = Number.isInteger(cParam) && cParam > 0 ? cParam : undefined;
  const { status } = useAuth();
  const authed = status === "authed";
  const n = Number(id);
  const valid = Number.isInteger(n) && n > 0;
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!authed || !valid) return;
    const ac = new AbortController();
    postDetailApi
      .get(n, ac.signal)
      .then((post) => {
        if (!ac.signal.aborted) setData({ id, post, status: 200 });
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setData({ id, post: null, status: e instanceof ApiError ? e.status : 0 });
      });
    return () => ac.abort();
  }, [authed, valid, n, id]);

  const noop = useCallback(() => {}, []);
  const patch = useCallback((_id: number, p: Partial<Post>) => {
    setData((d) => (d?.post ? { ...d, post: { ...d.post, ...p } } : d));
  }, []);
  const gone = useCallback(() => router.replace("/"), [router]);

  const cur = data && data.id === id ? data : null;
  let content: React.ReactNode;
  if (!valid || cur?.status === 404) {
    content = <Msg title="This post isn't available" sub="It may have been deleted." />;
  } else if (cur?.status === 410) {
    content = <Msg title="This story has expired" />;
  } else if (cur && !cur.post) {
    content = <Msg title="Couldn't load this post" sub="Check your connection and try again." />;
  } else if (cur?.post) {
    content = <FeedCard key={`${cur.post.id}:${focus ?? ""}`} post={cur.post} index={0} active near commentFocus={focus} onActivate={noop} patch={patch} onRemove={gone} />;
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
