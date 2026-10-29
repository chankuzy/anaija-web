/* eslint-disable @next/next/no-img-element */
"use client";

import { StickerView } from "@/components/chat/sticker-view";
import { Icon } from "@/components/ui/icon";
import type { Message } from "@/lib/api/messaging";
import { toPlain } from "@/lib/emoji/packs";
import { CUSTOM_STICKER_BODY } from "@/lib/stickers/custom";

export type ReplyRef = NonNullable<Message["reply_to"]>;

// Text that goes beside the thumbnail: the caption when there is one, otherwise what kind of thing it was.
export function replyLabel(r: ReplyRef, audio = false): string {
  if (audio || r.type === "audio") return "Voice message";
  if (r.type === "sticker" || r.body === CUSTOM_STICKER_BODY) return "Sticker";
  const body = r.body ? toPlain(r.body) : "";
  if (body.trim()) return body;
  switch (r.type) {
    case "image": return "Photo";
    case "video": return "Video";
    case "file": return "File";
    case "post_share": return "Shared a post";
    case "listing_share": return "Shared a listing";
    default: return "Attachment";
  }
}

// The actual sticker or picture, not a word for it. Null for plain text.
export function ReplyThumb({ reply, size = 32 }: { reply: ReplyRef; size?: number }) {
  const box = { width: size, height: size };
  if (reply.type === "sticker" && reply.body)
    return (
      <span className="shrink-0" style={box}>
        <StickerView code={reply.body} size={size} />
      </span>
    );
  if (reply.body === CUSTOM_STICKER_BODY && reply.media_url)
    return <img src={reply.media_url} alt="" draggable={false} className="shrink-0 select-none object-contain" style={box} />;
  if (reply.type === "image" && reply.media_url)
    return <img src={reply.media_url} alt="" draggable={false} loading="lazy" className="shrink-0 select-none rounded-lg object-cover" style={box} />;
  if (reply.type === "video" && reply.media_url)
    return (
      <span className="relative shrink-0 overflow-hidden rounded-lg bg-card" style={box}>
        <video src={`${reply.media_url}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
        <span className="absolute inset-0 grid place-items-center text-white">
          <Icon name="play" filled className="size-4" />
        </span>
      </span>
    );
  return null;
}

export function ReplyChip({ reply, onClick }: { reply: ReplyRef; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 flex max-w-full items-center gap-2 rounded-xl bg-white/8 py-1 pl-2.5 pr-1.5 text-left text-[12px] font-medium text-muted transition hover:bg-white/12"
    >
      <Icon name="reply" className="size-3.5 shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate">{replyLabel(reply)}</span>
      <ReplyThumb reply={reply} size={32} />
    </button>
  );
}
