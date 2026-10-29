/* eslint-disable @next/next/no-img-element */
import { Icon } from "@/components/ui/icon";
import { resolveSticker, stickerUrl } from "@/lib/stickers/packs";

/** Renders a sticker by its "pack/id" code. Stickers are shared assets, never re-uploaded per message. */
export function StickerView({ code, size = 144, className = "" }: { code: string; size?: number; className?: string }) {
  const r = resolveSticker(code);
  if (!r) return <span className="rounded-2xl bg-card-elevated px-3 py-2 text-supporting text-muted">Sticker unavailable</span>;
  return (
    <img
      src={stickerUrl(r.pack.id, r.sticker.id)}
      alt={r.sticker.label}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function StickerGlyph({ className = "size-5", filled = false }: { className?: string; filled?: boolean }) {
  return <Icon name="stickerSmileCircle" filled={filled} className={className} />;
}
