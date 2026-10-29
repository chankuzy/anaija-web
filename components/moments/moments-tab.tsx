"use client";

import { useEffect, useState } from "react";
import { Empty, useFetch } from "@/components/community/kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sk } from "@/components/ui/skeleton";
import { momentsApi, type MomentCardData } from "@/lib/api/moments";
import type { CommunityDetail } from "@/lib/api/communities";
import { useInterval } from "@/lib/messaging/use-interval";
import { MomentPicker } from "./create-moment";
import { MomentCard } from "./kit";

function useMoments(c: CommunityDetail) {
  const q = useFetch(c.can.read ? `moments:${c.id}` : null, () => momentsApi.list(c.slug), { persist: false });
  const { reload } = q;
  useEffect(() => {
    const on = () => reload();
    window.addEventListener("community:moments", on);
    return () => window.removeEventListener("community:moments", on);
  }, [reload]);
  return q;
}

function Section({ title, items }: { title: string; items: MomentCardData[] }) {
  if (!items.length) return null;
  return (
    <section>
      <p className="px-1 pb-2.5 pt-5 text-micro font-bold uppercase tracking-[0.1em] text-muted">{title}</p>
      <div className="space-y-2.5">{items.map((m) => <MomentCard key={m.code} c={m} />)}</div>
    </section>
  );
}

export function MomentsTab({ c }: { c: CommunityDetail }) {
  const q = useMoments(c);
  const [picker, setPicker] = useState(false);
  useInterval(q.reload, 60_000, c.can.read);
  const d = q.data;
  const empty = !!d && !d.live.length && !d.upcoming.length && !d.recent.length && !d.invites.length;
  return (
    <div>
      <div className="flex items-center gap-3 py-1">
        <p className="min-w-0 flex-1 text-[18px] font-extrabold tracking-tight text-fg">Moments</p>
        {c.is_member && <button type="button" onClick={() => setPicker(true)} className={buttonClass("primary", "h-10 px-5")}><Icon name="plus" className="size-4" />Create a Moment</button>}
      </div>
      {!c.can.read ? <Empty title="This community is members-only" body="Join to see what's happening." /> : q.loading ? (
        <div role="status" aria-busy="true" aria-label="Loading Moments" className="mt-4 space-y-2.5">{[0, 1, 2].map((i) => <Sk key={i} className="h-24 w-full rounded-[22px]" />)}</div>
      ) : q.error && !d ? (
        <Empty title="Couldn't load Moments" body={q.error}><button type="button" onClick={q.reload} className={buttonClass("primary", "h-10 px-5")}>Try again</button></Empty>
      ) : empty ? (
        <Empty title="Nothing is happening yet" body="Start a Hot Seat, put a dilemma to a vote, or challenge another community.">
          {c.is_member && <button type="button" onClick={() => setPicker(true)} className={buttonClass("primary", "h-10 px-5")}>Create a Moment</button>}
        </Empty>
      ) : d ? (
        <>
          <Section title="Live now" items={d.live} />
          <Section title="Challenges waiting" items={d.invites} />
          <Section title="Coming up" items={d.upcoming} />
          <Section title="Recently ended" items={d.recent} />
        </>
      ) : null}
      {picker && <MomentPicker c={c} onClose={() => setPicker(false)} />}
    </div>
  );
}

// A quiet strip on the Feed: only what is live or about to start. Shares the Moments tab's cache entry.
export function LiveStrip({ c }: { c: CommunityDetail }) {
  const q = useMoments(c);
  const items = [...(q.data?.live ?? []), ...(q.data?.upcoming ?? [])].slice(0, 6);
  if (!items.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pt-4">
      {items.map((m) => <MomentCard key={m.code} c={m} compact />)}
    </div>
  );
}
