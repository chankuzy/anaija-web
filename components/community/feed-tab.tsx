"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SheetAction } from "@/components/feed/options-sheet";
import { HomePost } from "@/components/home/home-post";
import { useToast } from "@/components/settings/settings-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CPost, type CommunityDetail } from "@/lib/api/communities";
import { useAuth } from "@/lib/auth/auth-context";
import { uploadManager } from "@/lib/create/upload-manager";
import { timeAgo } from "@/lib/format";
import { usePaged } from "@/lib/paged/use-paged";
import { confirmDialog } from "@/lib/ui/dialog";
import { Empty, ReportSheet, StatusChip, messageOf, useFetch } from "./kit";
import { PublishSheet } from "./publish-sheet";

const noop = () => {};

export function FeedTab({ c }: { c: CommunityDetail }) {
  const { toast, show } = useToast();
  const { user } = useAuth();
  const [share, setShare] = useState(false);
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
  const { loadMore, reload } = list;
  const { reload: reloadSessions } = sessions;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && loadMore(), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, hasMore, loadMore]);

  // Posts publish in the background through the shared upload manager; show them the moment they land.
  useEffect(() => uploadManager.onPublished((t) => { if (t.draft.community === c.slug) reload(); }), [c.slug, reload]);
  useEffect(() => {
    const on = () => reloadSessions();
    window.addEventListener("community:sessions", on);
    return () => window.removeEventListener("community:sessions", on);
  }, [reloadSessions]);

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

  // One menu per post: the post's own sheet, with the community actions added to it.
  const extraFor = (p: CPost): SheetAction[] => {
    const out: SheetAction[] = [];
    if (c.can.moderate) out.push({ icon: "pin", label: p.community_pinned ? "Unpin from top" : "Pin to top", onClick: () => void togglePin(p) });
    if (c.is_member && p.author?.id !== user?.id) out.push({ icon: "forbidden", label: "Report to moderators", onClick: () => setReport(p) });
    if (c.can.moderate) out.push({ icon: "trash", label: "Remove from community", destructive: true, onClick: () => void remove(p) });
    return out;
  };

  if (!c.can.read) {
    return <Empty title="This community is members-only" body="Join to see its posts, chat and library." />;
  }

  const live = (sessions.data ?? []).filter((s) => s.status !== "ended");
  const ended = (sessions.data ?? []).filter((s) => s.status === "ended");
  const canShare = c.can.post || c.can.announce;

  return (
    <div>
      {canShare && (
        <button type="button" onClick={() => setShare(true)} className="flex w-full items-center justify-between border-b border-white/[0.06] py-3.5 text-left text-body text-muted transition-colors hover:text-fg">
          <span>Share something with {c.name}</span>
          <Icon name="pen" className="size-[18px]" />
        </button>
      )}

      {(live.length > 0 || ended.length > 0) && (
        <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 py-4">
          {[...live, ...ended.slice(0, 4)].map((s) => (
            <Link key={s.id} href={`/s/${s.code}`} className="w-[200px] shrink-0 rounded-2xl border border-white/[0.07] p-3.5 transition-colors hover:bg-white/[0.04]">
              <StatusChip status={s.status} />
              <span className="mt-2.5 line-clamp-2 block text-[14px] font-bold leading-[1.25] text-fg">{s.title}</span>
              <span className="mt-1.5 block text-supporting text-muted">{s.posts_count} {s.posts_count === 1 ? "post" : "posts"} · {timeAgo(s.created_at)}</span>
            </Link>
          ))}
        </div>
      )}

      {list.loading && !list.data ? (
        <div role="status" aria-busy="true" aria-label="Loading posts" className="space-y-6 pt-4">
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
          body={canShare ? "Start with a post, a poll, a photo or a document." : c.is_member ? "Posts from this community will show up here." : "Join to post in this community."}
        >
          {canShare && <button type="button" onClick={() => setShare(true)} className={buttonClass("primary", "h-10 px-5")}>Share the first post</button>}
        </Empty>
      ) : (
        <div>
          {items.map((p, i) => (
            <div key={p.id} className="border-b border-white/[0.06] pt-4 last:border-none">
              {p.community_pinned && (
                <p className="mb-2 flex items-center gap-1.5 text-micro font-bold uppercase tracking-[0.08em] text-brand">
                  <Icon name="pin" filled className="size-3.5" />
                  Pinned
                </p>
              )}
              <HomePost post={p} index={i} active={false} onVisible={noop} patch={list.patch} onRemove={list.remove} extra={extraFor(p)} flush />
            </div>
          ))}
          <div ref={sentinel} className="h-px" />
          {list.data?.loadingMore && <Sk className="mx-auto h-1.5 w-20 rounded-full" />}
        </div>
      )}

      {share && <PublishSheet c={c} onClose={() => setShare(false)} />}
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
