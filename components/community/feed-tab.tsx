"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SheetAction } from "@/components/feed/options-sheet";
import { HomePost } from "@/components/home/home-post";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi, type CPost, type CommunityDetail } from "@/lib/api/communities";
import { mediaUrl } from "@/lib/api/feed";
import { useAuth } from "@/lib/auth/auth-context";
import { KIND_META, type CreateKind } from "@/lib/create/kinds";
import { uploadManager } from "@/lib/create/upload-manager";
import { usePaged } from "@/lib/paged/use-paged";
import { confirmDialog } from "@/lib/ui/dialog";
import { useToast } from "./cm-kit";
import { Empty, ReportSheet, messageOf, useFetch } from "./kit";
import { PublishSheet, canPublish, publishHref } from "./publish-sheet";

const QUICK: CreateKind[] = ["poll", "document", "announcement"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function FeedTab({ c, onOpenSessions }: { c: CommunityDetail; onOpenSessions: () => void }) {
  const router = useRouter();
  const { toast, show } = useToast();
  const { user } = useAuth();
  const [share, setShare] = useState(false);
  const [report, setReport] = useState<CPost | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // The post most in view is the "active" one: its slideshow slides and its reel plays.
  const ratios = useRef(new Map<number, number>());
  const [activeId, setActiveId] = useState<number | null>(null);
  const onVisible = useCallback((id: number, r: number) => {
    if (r > 0) ratios.current.set(id, r);
    else ratios.current.delete(id);
    let best: number | null = null;
    let top = 0.39;
    for (const [k, v] of ratios.current) if (v > top) { top = v; best = k; }
    setActiveId((prev) => (prev === best ? prev : best));
  }, []);

  const sessions = useFetch(c.can.read ? `sessions:${c.id}` : null, () => communitiesApi.sessions(c.slug));
  const load = useCallback(
    async (cursor: string | null) => {
      const r = await communitiesApi.feed(c.slug, cursor);
      return { items: r.posts, cursor: r.cursor, hasMore: r.hasMore };
    },
    [c.slug],
  );
  // First page is kept on disk (wiped on sign-out), so the feed opens instantly and works offline.
  const list = usePaged<CPost, string>({ id: `community:${c.id}`, enabled: c.can.read, load, staleMs: 30_000, persist: true });
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

  const live = (sessions.data ?? []).filter((s) => s.status === "live");
  const canShare = c.can.post || c.can.announce;
  const quick = QUICK.filter((k) => canPublish(c, k));

  return (
    <div>
      {canShare && (
        <div className="rounded-2xl border border-line bg-surface-subtle p-3">
          <button type="button" onClick={() => setShare(true)} className="flex w-full items-center gap-3 text-left">
            <Avatar url={user ? mediaUrl(user.avatar) : null} name={user?.name ?? user?.username} size={36} />
            <span className="min-w-0 flex-1 truncate text-body text-muted">Share something with {c.name}</span>
            <Icon name="pen" className="size-[18px] text-muted" />
          </button>
          {quick.length > 0 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {quick.map((k) => (
                <button key={k} type="button" onClick={() => router.push(publishHref(c, k))} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-surface-interactive px-3.5 text-secondary font-bold text-fg transition-colors hover:bg-surface-elevated">
                  <Icon name={KIND_META[k].icon} className="size-4" />
                  {KIND_META[k].title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {live.length > 0 && (
        <button type="button" onClick={onOpenSessions} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-subtle px-4 py-3 text-left text-fg">
          <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-fg"><Icon name="eyeClosed" filled className="size-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{live[0].title}</span>
            <span className="block text-supporting text-muted">{plural(live.length, "live anonymous session", "live anonymous sessions")}</span>
          </span>
          <span className="text-secondary font-extrabold text-brand">Open</span>
        </button>
      )}

      <div className="mt-4">
        {list.loading && !list.data ? (
          <div role="status" aria-busy="true" aria-label="Loading posts" className="space-y-6 pt-2">
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
          // Interim dark island: posts, sheets and renderers are still dark-designed.
          <div className="cm-dark rounded-[22px] px-3">
            {items.map((p, i) => (
              <div key={p.id} className="border-b border-line pt-4 last:border-none">
                <div className="w-full max-w-[11cm] [&_[aria-roledescription=carousel]]:!aspect-[4/5]">
                  {p.community_pinned && (
                    <p className="mb-2 flex items-center gap-1.5 text-micro font-bold uppercase tracking-[0.08em] text-brand">
                      <Icon name="pin" filled className="size-3.5" />
                      Pinned
                    </p>
                  )}
                  <HomePost post={p} index={i} active={p.id === activeId} onVisible={onVisible} patch={list.patch} onRemove={list.remove} extra={extraFor(p)} flush />
                </div>
              </div>
            ))}
            <div ref={sentinel} className="h-px" />
            {list.data?.loadingMore && <Sk className="mx-auto h-1.5 w-20 rounded-full" />}
          </div>
        )}
      </div>

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
