"use client";

import { ThreadPane } from "@/components/messaging/thread-pane";
import type { CommunityDetail } from "@/lib/api/communities";
import { Empty } from "./kit";
import { buttonClass } from "@/components/ui/button";

export function ChatTab({ c, onJoin }: { c: CommunityDetail; onJoin: () => void }) {
  if (!c.is_member) {
    return (
      <Empty title="Chat is for members" body="Join to talk with everyone in this community in real time.">
        {c.join_policy !== "invite" && c.request_status !== "pending" && (
          <button type="button" onClick={onJoin} className={buttonClass("primary", "h-10 px-5")}>
            {c.join_policy === "request" ? "Request to join" : "Join"}
          </button>
        )}
      </Empty>
    );
  }
  if (!c.chat_conversation_id) return <Empty title="Chat isn't available" body="This community's chat couldn't be found." />;
  return (
    <div
      className="overflow-hidden rounded-[22px] bg-surface-subtle"
      style={{ height: "calc(100dvh - var(--nav-h, 0px) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 84px)", minHeight: 360 }}
    >
      <ThreadPane conversationId={c.chat_conversation_id} embedded />
    </div>
  );
}
