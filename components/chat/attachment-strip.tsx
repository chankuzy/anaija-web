/* eslint-disable @next/next/no-img-element */
"use client";

import { Icon } from "@/components/ui/icon";
import { useBlobUrl } from "@/lib/chat/use-blob-url";
import type { PickedFile } from "@/lib/chat/types";

function Thumb({ item, onRemove }: { item: PickedFile; onRemove: () => void }) {
  const url = useBlobUrl(item.thumb);
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-[14px] bg-card">
      {url ? (
        <img src={url} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted"><Icon name="videocamera" filled className="size-5" /></span>
      )}
      {item.kind === "video" && url && <span className="absolute bottom-1 left-1 text-white"><Icon name="videocamera" filled className="size-3.5" /></span>}
      {item.edited && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[9.5px] font-bold text-white">Edited</span>}
      <button type="button" aria-label="Remove attachment" onClick={onRemove} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white">
        <Icon name="close" className="size-3" />
      </button>
    </div>
  );
}

export function AttachmentStrip({ items, onRemove }: { items: PickedFile[]; onRemove: (id: string) => void }) {
  return (
    <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto px-1">
      {items.map((it) => (
        <Thumb key={it.id} item={it} onRemove={() => onRemove(it.id)} />
      ))}
    </div>
  );
}
