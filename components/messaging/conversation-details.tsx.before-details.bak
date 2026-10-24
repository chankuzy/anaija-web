"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { convAvatar, convName, isInquiry, type Conversation, type Message } from "@/lib/api/messaging";
import { RingAvatar } from "./ring-avatar";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-secondary">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-fg">{value}</span>
    </div>
  );
}

// Right-hand details column (xl+): who you are talking to, conversation info and shared media.
export function ConversationDetails({
  conv,
  messages,
  ring,
  onClose,
}: {
  conv: Conversation;
  messages: Message[];
  ring: boolean;
  onClose: () => void;
}) {
  const name = convName(conv);
  const username = conv.other_user?.username;
  const media = messages.filter((m) => !m.is_deleted && !!m.media_url && (m.type === "image" || m.type === "video"));
  const shown = [...media].reverse().slice(0, 9);
  const kind = conv.type === "group" ? "Group" : isInquiry(conv) ? "Marketplace inquiry" : "Direct message";

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-white/8 xl:flex" aria-label="Conversation details">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3.5">
        <h2 className="flex-1 text-[15px] font-bold text-fg">Details</h2>
        <button type="button" aria-label="Close details" onClick={onClose} className="grid size-9 place-items-center rounded-full text-white/60 hover:bg-white/8 hover:text-white">
          <Icon name="close" className="size-[18px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex flex-col items-center pt-7 text-center">
          <RingAvatar url={convAvatar(conv)} name={name} size={96} ring={ring} />
          <p className="mt-4 max-w-full truncate text-[19px] font-bold tracking-tight text-fg">{name}</p>
          {username && <p className="mt-0.5 max-w-full truncate text-secondary text-muted">@{username}</p>}
          {username && (
            <Link href={`/u/${username}`} className="mt-4 inline-flex h-10 items-center rounded-full bg-white/10 px-5 text-secondary font-semibold text-fg transition-colors hover:bg-white/16">
              View profile
            </Link>
          )}
        </div>

        <div className="mt-6 divide-y divide-white/8 border-y border-white/8">
          <Row label="Type" value={kind} />
          <Row label="Notifications" value={conv.is_muted ? "Muted" : "On"} />
          {conv.request_status === "pending" && <Row label="Status" value="Message request" />}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-micro font-bold uppercase tracking-[0.12em] text-muted">Shared media</h3>
          {media.length > 0 && <span className="text-supporting font-semibold text-muted">{media.length}</span>}
        </div>
        {shown.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/5 px-4 py-6 text-center text-secondary text-muted">No photos or videos yet</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
            {shown.map((m) => (
              <a key={m.id} href={m.media_url ?? "#"} target="_blank" rel="noreferrer" className="relative block aspect-square bg-card">
                {m.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.media_url!} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                ) : (
                  <>
                    <video src={m.media_url!} preload="metadata" muted className="size-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center text-white icon-shadow">
                      <Icon name="play" filled className="size-6" />
                    </span>
                  </>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
