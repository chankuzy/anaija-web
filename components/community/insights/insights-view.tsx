"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { communitiesApi } from "@/lib/api/communities";
import { insightsApi } from "@/lib/api/community-insights";
import { useAuth } from "@/lib/auth/auth-context";
import { openAuth } from "@/lib/auth/auth-modal";
import { timeAgo } from "@/lib/format";
import { Chip, Cm, Empty, useFetch } from "../kit";
import { ContentSection } from "./content-section";
import { Engagement, Growth, Overview, Retention, Rewards, type SectionId } from "./sections";

const SECTIONS: [SectionId, string][] = [
  ["overview", "Overview"], ["growth", "Growth"], ["engagement", "Engagement"],
  ["content", "Content"], ["retention", "Retention"], ["rewards", "Rewards"],
];

function Skeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading insights" className="space-y-6 pt-4">
      <div className="space-y-2.5 px-1">
        <Sk className="h-6 w-[88%] rounded-full" />
        <Sk className="h-6 w-[60%] rounded-full" />
        <Sk className="h-3.5 w-[75%] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((k) => <Sk key={k} className="h-[104px] rounded-[20px]" />)}
      </div>
      <Sk className="h-[260px] w-full rounded-[20px]" />
    </div>
  );
}

const updated = (iso: string) => {
  const t = timeAgo(iso);
  return t === "now" ? "Updated just now" : /^\d+[mhdw]$/.test(t) ? `Updated ${t} ago` : `Updated ${t}`;
};

export function InsightsView({ slug }: { slug: string }) {
  const { status } = useAuth();
  const [section, setSection] = useState<SectionId>("overview");
  // Same key and loader as the community page, so both share one cached request.
  const det = useFetch(status === "loading" ? null : `c:${slug}:${status}`, () => communitiesApi.show(slug));
  const c = det.data;
  const cid = c?.id ?? 0;
  const allowed = !!c && c.can.manage;
  const ins = useFetch(allowed ? `cins:${cid}` : null, () => insightsApi.overview(cid), { persist: false });
  const d = ins.data;

  const back = <Link href={`/c/${slug}`} className={buttonClass("primary", "h-10 px-5")}>Back to community</Link>;
  let body: ReactNode;

  if (status === "guest") {
    body = (
      <Empty title="Sign in to see insights" body="Community Insights are for the people who lead a community.">
        <button type="button" onClick={() => openAuth()} className={buttonClass("primary", "h-10 px-5")}>Sign in</button>
      </Empty>
    );
  } else if (!c) {
    body = det.error ? (
      <Empty title="Couldn't load this community" body={det.error}>
        <button type="button" onClick={det.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
      </Empty>
    ) : <Skeleton />;
  } else if (!allowed) {
    body = <Empty title="Insights are for Community Leaders" body="Only the Community Leader and admins of this community can see its insights.">{back}</Empty>;
  } else if (!d) {
    body = ins.error ? (
      <Empty title="Couldn't load insights" body={ins.error}>
        <button type="button" onClick={ins.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button>
      </Empty>
    ) : <Skeleton />;
  } else if (d.base_members === 0 && d.content.total === 0 && d.activity.contributions === 0) {
    body = (
      <Empty title="Your insights will appear here" body="Once members join and start taking part, you'll see how your community is growing, who comes back and what is working.">
        {back}
      </Empty>
    );
  } else {
    body = (
      <>
        <nav
          aria-label="Insight sections"
          className="sticky top-0 z-10 -mx-3 border-b border-line bg-bg/95 px-3 pb-2.5 backdrop-blur"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
        >
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {SECTIONS.map(([id, label]) => <Chip key={id} active={section === id} onClick={() => setSection(id)}>{label}</Chip>)}
          </div>
        </nav>
        {!d.history_complete && section !== "content" && (
          <p className="mt-4 rounded-2xl bg-surface-interactive px-4 py-3 text-secondary leading-[1.5] text-muted">
            This community is under 60 days old. Comparisons with the previous month will appear once there&apos;s enough history.
          </p>
        )}
        <div key={section} className="sv-rise pt-5">
          {section === "overview" && <Overview i={d} />}
          {section === "growth" && <Growth i={d} />}
          {section === "engagement" && <Engagement i={d} />}
          {section === "content" && <ContentSection id={cid} i={d} />}
          {section === "retention" && <Retention i={d} />}
          {section === "rewards" && <Rewards i={d} />}
        </div>
      </>
    );
  }

  return (
    <Cm>
      <div className="mx-auto w-full max-w-[720px] px-3 pb-28 pt-3 md:pt-8">
        <header className="flex items-center gap-3 px-0.5 py-2">
          <Link href={`/c/${slug}`} aria-label="Back to community" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-interactive text-fg transition-transform active:scale-95">
            <Icon name="back" className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-extrabold tracking-tight text-fg">Community Insights</h1>
            <p className="truncate text-supporting text-muted">
              {c ? c.name : "\u00a0"} · Last 30 days{d ? ` · ${updated(d.generated_at)}` : ""}
            </p>
          </div>
        </header>
        {body}
      </div>
    </Cm>
  );
}
