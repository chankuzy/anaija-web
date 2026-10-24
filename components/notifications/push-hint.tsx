"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { usePush } from "@/lib/push/web-push";

/** A slim row at the top of the activity panel for people who haven't turned push on yet. */
export function PushHint() {
  const push = usePush();
  const [err, setErr] = useState<string | null>(null);
  if (push.state !== "off") return null;

  async function on() {
    setErr(null);
    try {
      await push.toggle(true);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Couldn't turn on notifications");
    }
  }

  return (
    <div className="shrink-0 px-3 pb-2">
      <div className="flex items-center gap-3 rounded-2xl bg-white/6 px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
          <Icon name="bell" filled className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-fg">Turn on push notifications</span>
          <span className="block text-supporting text-muted">{err ?? "Know the moment someone messages you or likes your post."}</span>
        </span>
        <button
          type="button"
          disabled={push.busy}
          onClick={() => void on()}
          className="h-9 shrink-0 rounded-full bg-brand px-4 text-secondary font-extrabold text-brand-fg transition active:scale-95 disabled:opacity-50"
        >
          Turn on
        </button>
      </div>
    </div>
  );
}
