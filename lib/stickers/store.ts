// Recents + favourites are just "pack/id" strings (no media is copied). Kept on this device and wiped on sign-out.
import { onCacheClear } from "@/lib/cache/swr";
import { resolveSticker } from "./packs";

const REC = "anaija:stickers:recent";
const FAV = "anaija:stickers:fav";
const MAX_RECENT = 24;
const MAX_FAV = 200;

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!resolveSticker(x)) : [];
  } catch {
    return [];
  }
}
function write(key: string, list: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* storage full or blocked: stickers still send, they just aren't remembered */
  }
}

if (typeof window !== "undefined") {
  onCacheClear(() => {
    try {
      window.localStorage.removeItem(REC);
      window.localStorage.removeItem(FAV);
    } catch {}
  });
}

export const getRecents = () => read(REC);
export const getFavourites = () => read(FAV);
export const pushRecent = (code: string) => write(REC, [code, ...read(REC).filter((x) => x !== code)].slice(0, MAX_RECENT));
export const addFavourite = (code: string) => {
  if (resolveSticker(code)) write(FAV, [code, ...read(FAV).filter((x) => x !== code)].slice(0, MAX_FAV));
};
/** Returns true when the sticker is now a favourite. */
export function toggleFavourite(code: string): boolean {
  const cur = read(FAV);
  if (cur.includes(code)) {
    write(FAV, cur.filter((x) => x !== code));
    return false;
  }
  addFavourite(code);
  return true;
}
