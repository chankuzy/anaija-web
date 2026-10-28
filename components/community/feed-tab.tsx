"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomePost } from "@/components/home/home-post";
import { useToast } from "@/components/settings/settings-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CPost, type CommunityDetail } from "@/lib/api/communities";
import { timeAgo } from "@/lib/format";
import { usePaged } from "@/lib/paged/use-paged";
import { confirmDialog } from "@/lib/ui/dialog";
import { ComposerSheet, type ComposeMode } from "./composer";
import { Empty, ReportSheet, StatusChip, messageOf, useFetch } from "./kit";
import { SessionCreate } from "./session-create";

const noop = () => {};

export function FeedTab({ c }: { c: CommunityDetail }) {
  const { toast, show } = useToast();
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [report, setReport] = useState<CPost | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const sessions = useFetch(c.can.read ? `sessions:${c.id}` : null, () => communitiesApi.sessions(c.slug));
  const load = useCallback(
    async (cursor: string | null) => {
      const r = await communitiesApi.feed(c.slug, cursor);
      return { items: r.posts, cursor: r.cursor, hasMore: r.hasMore };
    },
    [c.slug],
  );
  // Private community content is never written to disk (persist=false).
  const list = usePaged<CPost, string>({ id: `community:${c.id}`, enabled: c.can.read, load, staleMs: 0, persist: false });
  const items = list.data?.items ?? [];
  const hasMore = list.data?.hasMore ?? false;
  const { loadMore } = list;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadMore(), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, hasMore, loadMore]);

  async function togglePin(p: CPost) {
    try {
      await communitiesApi.pin(c.id, p.id, !p.community_pinned);
      list.reload();
    } catch (e) {
      show(messageOf(e));
    }
  }
  async function remove(p: CPost) {
    if (!(await confirmDialog({ title: "Remove this post?", message: "The author will be told a moderator removed it.", confirmLabel: "Remove", danger: true }))) return;
    try {
      await communitiesApi.postRemove(c.id, p.id);
      list.remove(p.id);
    } catch (e) {
      show(messageOf(e));
    }
  }

  if (!c.can.read) {
    return <Empty title="This community is members-only" body="Join to see its posts, chat and library." />;
  }

  const live = (sessions.data ?? []).filter((s) => s.status !== "ended");
  const ended = (sessions.data ?? []).filter((s) => s.status === "ended");

  return (
    <div>
      {(c.can.post || c.can.announce || c.can.session) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(c.can.post || c.can.announce) && (
            <button type="button" onClick={() => setCompose(c.can.post ? "post" : "announcement")} className={buttonClass("primary", "h-10 px-4")}>
              <Icon name="pen" className="size-4" />
              Share
            </button>
          )}
          {c.can.announce && c.can.post && (
            <button type="button" onClick={() => setCompose("announcement")} className={buttonClass("outline", "h-10 px-4")}>
              <Icon name="bell" className="size-4" />
              Announce
            </button>
          )}
          {c.can.session && (
            <button type="button" onClick={() => setSessionOpen(true)} className={buttonClass("outline", "h-10 px-4")}>
              <Icon name="eyeClosed" className="size-4" />
              Start anonymous session
            </button>
          )}
        </div>
      )}

      {(live.length > 0 || ended.length > 0) && (
        <div className="no-scrollbar mb-4 flex gap-2.5 overflow-x-auto">
          {[...live, ...ended.slice(0, 4)].map((s) => (
            <Link key={s.id} href={`/s/${s.code}`} className="w-[220px] shrink-0 rounded-[20px] bg-surface-subtle p-4 transition-colors hover:bg-surface-interactive">
              <StatusChip status={s.status} />
              <span className="mt-2.5 line-clamp-2 block text-[15px] font-bold leading-[1.25] text-fg">{s.title}</span>
              <span className="mt-1.5 block text-supporting text-muted">
                {s.posts_count} {s.posts_count === 1 ? "post" : "posts"} · {timeAgo(s.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {list.loading && !list.data ? (
        <div role="status" aria-busy="true" aria-label="Loading posts" className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-3"><Sk className="size-9 rounded-full" /><Sk className="h-3.5 w-32 rounded-full" /></div>
              <Sk className="h-4 w-[85%] rounded-full" />
              <Sk className="h-40 w-full rounded-[22px]" />
            </div>
          ))}
        </div>
      ) : list.data?.error && items.length === 0 ? (
        <Empty title="Couldn't load posts" body={list.data.error}>
          <button type="button" onClick={list.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
        </Empty>
      ) : items.length === 0 ? (
        <Empty
          title="Nothing here yet"
          body={c.can.post ? "Start the conversation with a post, a poll or a photo." : c.is_member ? "Posts from this community will show up here." : "Join to post in this community."}
        >
          {c.can.post && <button type="button" onClick={() => setCompose("post")} className={buttonClass("primary", "h-10 px-5")}>Write the first post</button>}
        </Empty>
      ) : (
        <div className="space-y-2">
          {items.map((p, i) => (
            <div key={p.id} className={p.community_pinned ? "rounded-[26px] bg-white/[0.035] pt-3" : ""}>
              {p.community_pinned && (
                <p className="flex items-center gap-1.5 px-5 text-micro font-bold uppercase tracking-[0.08em] text-brand">
                  <Icon name="pin" filled className="size-3.5" />
                  Pinned
                </p>
              )}
              <HomePost post={p} index={i} active={false} onVisible={noop} patch={list.patch} onRemove={list.remove} />
              {c.is_member && (
                <div className="-mt-4 mb-4 flex gap-4 px-4 text-supporting font-semibold text-muted">
                  {c.can.moderate && (
                    <>
                      <button type="button" onClick={() => void togglePin(p)} className="hover:text-fg">{p.community_pinned ? "Unpin" : "Pin"}</button>
                      <button type="button" onClick={() => void remove(p)} className="hover:text-danger">Remove</button>
                    </>
                  )}
                  <button type="button" onClick={() => setReport(p)} className="hover:text-fg">Report</button>
                </div>
              )}
            </div>
          ))}
          <div ref={sentinel} className="h-px" />
          {list.data?.loadingMore && <Sk className="mx-auto h-1.5 w-20 rounded-full" />}
        </div>
      )}

      {compose && (
        <ComposerSheet
          c={c}
          start={compose}
          onClose={() => setCompose(null)}
          onDone={() => {
            setCompose(null);
            list.reload();
            show("Published");
          }}
        />
      )}
      {sessionOpen && <SessionCreate c={c} onClose={() => setSessionOpen(false)} onCreated={() => sessions.reload()} />}
      {report && (
        <ReportSheet
          title="Report post"
          onClose={() => setReport(null)}
          onSubmit={(reason) => communitiesApi.report(c.id, { kind: "post", target_id: report.id, reason }).then(() => show("Report sent"))}
        />
      )}
      {toast}
    </div>
  );
}
