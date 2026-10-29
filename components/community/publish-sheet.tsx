"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import type { CommunityDetail } from "@/lib/api/communities";
import { KIND_META, type CreateKind } from "@/lib/create/kinds";
import { Sheet } from "./kit";

const ORDER: CreateKind[] = ["photo", "reel", "document", "poll", "article", "announcement", "listing"];
const SUB: Partial<Record<CreateKind, string>> = {
  poll: "Ask the community", announcement: "Notify every member", article: "Long-form editorial", reel: "A video for the community",
};

// One publishing system: the real composer, aimed at this community. /create/new reads ?mode=.
export function PublishSheet({ c, onClose }: { c: CommunityDetail; onClose: () => void }) {
  const router = useRouter();
  const allowed = (k: CreateKind) => (k === "announcement" ? c.can.announce : k === "article" ? c.can.moderate : c.can.post);
  const kinds = ORDER.filter(allowed);
  return (
    <Sheet title="Share with the community" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => router.push(`/create/new?mode=${k}&community=${encodeURIComponent(c.slug)}`)}
            className="flex flex-col items-start gap-3 rounded-2xl border border-white/[0.07] p-4 text-left transition-colors hover:bg-white/[0.04] active:scale-[0.98]"
          >
            <Icon name={KIND_META[k].icon} className="size-6 text-fg" />
            <span>
              <span className="block text-[15px] font-bold text-fg">{KIND_META[k].title}</span>
              <span className="mt-0.5 block text-supporting leading-[1.3] text-muted">{SUB[k] ?? KIND_META[k].sub}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
