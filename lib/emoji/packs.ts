// Anaija's own emoji. In text they are stored as :id: shortcodes (ids are 2-8 lowercase letters, so a reaction
// stays short). Anything that can't draw them (previews, copy, old clients) falls back to the unicode in `u`.
import manifest from "./manifest.json";

export interface EmojiDef {
  id: string;
  label: string;
  /** Unicode fallback. */
  u: string;
}

export const EMOJI = manifest as EmojiDef[];
const BY_ID = new Map(EMOJI.map((e) => [e.id, e]));

export const isEmojiId = (id: string) => BY_ID.has(id);
export const emojiUrl = (id: string) => `/emoji/${id}.svg`;
export const QUICK_REACTIONS = [":like:", ":heart:", ":joy:", ":shock:", ":cry:", ":pray:"];

export type Piece = string | { id: string };

export function splitRich(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(/:([a-z]{2,8}):/g)) {
    if (!BY_ID.has(m[1])) continue;
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push({ id: m[1] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Plain-text version: shortcodes become their unicode twin. */
export function toPlain(s: string): string;
export function toPlain(s: string | null | undefined): string | null;
export function toPlain(s: string | null | undefined): string | null {
  if (s == null) return null;
  return s.replace(/:([a-z]{2,8}):/g, (all, id: string) => BY_ID.get(id)?.u ?? all);
}
