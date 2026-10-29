// Anaija emoji. Messages store plain unicode. Emoji we have custom art for are drawn as that art, every other
// emoji renders natively. Old ":id:" shortcodes still render and fall back to their unicode twin in plain text.
import emojiRegex from "emoji-regex";
import manifest from "./manifest.json";

export interface EmojiDef {
  id: string;
  label: string;
  /** Unicode twin. */
  u: string;
}

export const EMOJI = manifest as EmojiDef[];
const BY_ID = new Map(EMOJI.map((e) => [e.id, e]));
const bare = (s: string) => s.replace(/\uFE0F/g, "");
const BY_UNI = new Map<string, EmojiDef>();
for (const e of EMOJI) if (!BY_UNI.has(bare(e.u))) BY_UNI.set(bare(e.u), e);

export const isEmojiId = (id: string) => BY_ID.has(id);
export const emojiById = (id: string) => BY_ID.get(id) ?? null;
export const customFor = (u: string) => BY_UNI.get(bare(u)) ?? null;
export const emojiUrl = (id: string) => `/emoji/${id}.svg`;
export const QUICK_REACTIONS = [":like:", ":heart:", ":joy:", ":shock:", ":cry:", ":pray:"];

export type RichPart = { k: "text"; s: string } | { k: "art"; id: string; u: string } | { k: "native"; s: string };

const RE_SRC = `:([a-z]{2,8}):|${emojiRegex().source}`;
// Compiled once. matchAll works on a clone, so sharing this instance is safe.
const RE = new RegExp(RE_SRC, "g");

// Parsed results are cached by text: a thread re-renders on every keystroke, and each bubble asks twice.
const CACHE = new Map<string, RichPart[]>();
export function richParts(text: string): RichPart[] {
  const hit = CACHE.get(text);
  if (hit) return hit;
  const parts = parseRich(text);
  if (CACHE.size >= 500) CACHE.clear();
  CACHE.set(text, parts);
  return parts;
}

function parseRich(text: string): RichPart[] {
  const out: RichPart[] = [];
  const push = (s: string) => {
    if (s) out.push({ k: "text", s });
  };
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const at = m.index ?? 0;
    let part: RichPart | null = null;
    if (m[1] !== undefined) {
      const d = BY_ID.get(m[1]);
      if (d) part = { k: "art", id: d.id, u: d.u };
    } else if (!/^[0-9#*]$/.test(m[0])) {
      const d = customFor(m[0]);
      part = d ? { k: "art", id: d.id, u: d.u } : { k: "native", s: m[0] };
    }
    if (!part) continue;
    push(text.slice(last, at));
    out.push(part);
    last = at + m[0].length;
  }
  push(text.slice(last));
  return out;
}

/** How many emoji the text is made of, if it is nothing but emoji (and spaces). 0 otherwise. */
export function emojiOnly(text: string): number {
  const parts = richParts(text.trim());
  if (parts.length === 0) return 0;
  let n = 0;
  for (const p of parts) {
    if (p.k === "text") {
      if (p.s.trim() !== "") return 0;
    } else n++;
  }
  return n;
}

/** Plain-text version: shortcodes become their unicode twin. */
export function toPlain(s: string): string;
export function toPlain(s: string | null | undefined): string | null;
export function toPlain(s: string | null | undefined): string | null {
  if (s == null) return null;
  return s.replace(/:([a-z]{2,8}):/g, (all, id: string) => BY_ID.get(id)?.u ?? all);
}
