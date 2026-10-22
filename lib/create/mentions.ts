const MENTION = /(?<![\w@])@(\w+)/g;

/** Usernames mentioned in a caption, de-duplicated, in order of first appearance. */
export const mentionsOf = (text: string): string[] => [...new Set([...text.matchAll(MENTION)].map((m) => m[1]))];

/** The `@query` being typed immediately before the caret, if any. `start` is the index of the `@`. */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const m = /(?:^|\s)@(\w*)$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1] };
}

/** Splits text into plain and mention runs, for the highlight layer. */
export function splitMentions(text: string): { text: string; mention: boolean }[] {
  const out: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), mention: false });
    out.push({ text: m[0], mention: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}
