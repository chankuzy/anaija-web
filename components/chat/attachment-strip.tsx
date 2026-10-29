/* eslint-disable @next/next/no-img-element */
"use client";

import { Icon } from "@/components/ui/icon";
import { useBlobUrl } from "@/lib/chat/use-blob-url";
import type { PickedFile } from "@/lib/chat/types";

function Thumb({ item, active, onSelect, onRemove }: { item: PickedFile; active: boolean; onSelect: () => void; onRemove: () => void }) {
  const url = useBlobUrl(item.thumb);
  return (
    <div className={`relative size-[68px] shrink-0 overflow-hidden rounded-[14px] bg-card ring-2 transition ${active ? "ring-white" : "ring-transparent"}`}>
      <button type="button" aria-label="Caption this attachment" aria-pressed={active} onClick={onSelect} className="block size-full">
        {url ? (
          <img src={url} alt="" draggable={false} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-muted"><Icon name="videocamera" filled className="size-5" /></span>
        )}
      </button>
      {item.kind === "video" && url && <span className="pointer-events-none absolute bottom-1 left-1 text-white"><Icon name="videocamera" filled className="size-3.5" /></span>}
      {item.caption?.trim() && <span className="pointer-events-none absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white"><Icon name="chatLine" filled className="size-3" /></span>}
      {item.edited && <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[9.5px] font-bold text-white">Edited</span>}
      <button type="button" aria-label="Remove attachment" onClick={onRemove} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white">
        <Icon name="close" className="size-3" />
      </button>
    </div>
  );
}

export function AttachmentStrip({
  items,
  activeId,
  onSelect,
  onRemove,
}: {
  items: PickedFile[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const active = activeId ?? items[0]?.id ?? null;
  return (
    <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto px-1 py-1">
      {items.map((it) => (
        <Thumb key={it.id} item={it} active={items.length > 1 && it.id === active} onSelect={() => onSelect?.(it.id)} onRemove={() => onRemove(it.id)} />
      ))}
    </div>
  );
}
