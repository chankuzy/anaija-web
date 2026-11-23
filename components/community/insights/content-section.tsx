"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Sk } from "@/components/ui/skeleton";
import { insightsApi, type ContentRow, type Insights } from "@/lib/api/community-insights";
import { TYPE_LABEL, fmt } from "@/lib/community/insights/model";
import { Chip, Empty, messageOf, useFetch } from "../kit";
import { Bar, Note, Surface } from "./ui";

const TYPES: [string | null, string][] = [
  [null, "All"], ["announcement", "Announcements"], ["post", "Posts"], ["poll", "Polls"], ["document", "Resources"], ["article", "Editorials"],
];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-0.5 text-[16px] font-extrabold tabular-nums text-fg">{value}</p>
    </div>
  );
}

function Item({ r }: { r: ContentRow }) {
  return (
    <li className="py-4">
      <p className="line-clamp-2 text-[15px] font-semibold leading-[1.3] text-fg">{r.preview || "Untitled post"}</p>
      <p className="mt-1 text-supporting text-muted">
        {TYPE_LABEL[r.type] ?? "Post"} · {day(r.created_at)}{r.pinned ? " · Pinned" : ""}{r.author.name ? ` · ${r.author.name}` : ""}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Fig label="Reach" value={r.viewers === null ? "—" : `${fmt(r.viewers)}${r.reach_partial ? "+" : ""}`} />
        <Fig label="Interactions" value={fmt(r.interactions)} />
        <Fig label="Response" value={r.response === null ? "—" : `${r.response}%`} />
      </div>
      {r.response !== null && <div className="mt-2.5"><Bar value={r.response} total={100} /></div>}
    </li>
  );
}

export function ContentSection({ id, i }: { id: number; i: Insights }) {
  const [type, setType] = useState<string | null>(null);
  const [sort, setSort] = useState<"top" | "recent">("top");
  const [extra, setExtra] = useState<{ key: string; items: ContentRow[]; page: number; more: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = `${type ?? "all"}:${sort}`;
  const first = useFetch(`cins-content:${id}:${key}`, () => insightsApi.content(id, { type, sort, page: 1 }), { persist: false });
  const more = extra?.key === key ? extra : null;
  const items = [...(first.data?.items ?? []), ...(more?.items ?? [])];
  const hasMore = more ? more.more : (first.data?.has_more ?? false);

  async function loadMore() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const page = (more?.page ?? 1) + 1;
      const r = await insightsApi.content(id, { type, sort, page });
      setExtra({ key, items: [...(more?.items ?? []), ...r.items], page, more: r.has_more });
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const since = i.tracking?.since ? new Date(i.tracking.since).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TYPES.map(([t, label]) => <Chip key={label} active={type === t} onClick={() => setType(t)}>{label}</Chip>)}
      </div>
      <div className="flex gap-2">
        <Chip active={sort === "top"} onClick={() => setSort("top")}>Most response</Chip>
        <Chip active={sort === "recent"} onClick={() => setSort("recent")}>Newest</Chip>
      </div>

      {first.loading && !first.data ? (
        <div role="status" aria-busy="true" aria-label="Loading content" className="space-y-5 pt-2">
          {[0, 1, 2].map((k) => (
            <div key={k} className="space-y-2.5">
              <Sk className="h-4 w-[85%] rounded-full" />
              <Sk className="h-3 w-40 rounded-full" />
              <Sk className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : first.error && !first.data ? (
        <Empty title="Couldn't load content" body={first.error}>
          <button type="button" onClick={first.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
        </Empty>
      ) : items.length === 0 ? (
        <Empty title="Nothing published yet" body="Announcements, polls, posts and resources will show here with how members responded." />
      ) : (
        <>
          <Surface className="py-1"><ul className="divide-y divide-line">{items.map((r) => <Item key={r.id} r={r} />)}</ul></Surface>
          {hasMore && (
            <button type="button" disabled={busy} onClick={() => void loadMore()} className={buttonClass("outline", "mx-auto h-10")}>
              {busy ? "Loading…" : "Show more"}
            </button>
          )}
          {err && <p role="alert" className="text-center text-secondary text-danger">{err}</p>}
        </>
      )}
      <Note>
        Reach counts members who opened the post in the feed{since ? ` since ${since}` : ", and tracking has just started, so it will fill in as members read"}. A + means the post is older than tracking, so the true number may be higher.
        Response is the share of members who liked, saved, commented or voted. Views and actions from the same person are counted once.
      </Note>
    </div>
  );
}
