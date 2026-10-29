/* eslint-disable @next/next/no-img-element */
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

export function StickerGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 12.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5.5L20 12.5Z" />
      <path d="M20 12.5h-3a3 3 0 0 0-3 3V20" />
      <path d="M8.5 9.5h.01M15.5 9.5h.01" />
      <path d="M8.5 14c.9.8 2 1.2 3 1" />
    </svg>
  );
}
