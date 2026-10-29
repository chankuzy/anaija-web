import manifest from "./manifest.json";

export interface Sticker {
  id: string;
  label: string;
}
export interface StickerPack {
  id: string;
  name: string;
  creator: string;
  license: string;
  format: string;
  size: number;
  stickers: Sticker[];
}

export const PACKS = manifest.packs as unknown as StickerPack[];

export const stickerUrl = (packId: string, id: string) => `/stickers/${packId}/${id}.svg`;

/** "pack/id" -> the pack + sticker, or null when it is malformed or unknown (e.g. a newer pack). */
export function resolveSticker(code: string | null | undefined): { pack: StickerPack; sticker: Sticker } | null {
  if (!code) return null;
  const [p, s, ...rest] = code.split("/");
  if (rest.length || !p || !s) return null;
  const pack = PACKS.find((x) => x.id === p);
  const sticker = pack?.stickers.find((x) => x.id === s);
  return pack && sticker ? { pack, sticker } : null;
}
