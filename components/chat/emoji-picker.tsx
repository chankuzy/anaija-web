"use client";

import { useEffect, useMemo, useState } from "react";
import { EMOJI } from "@/lib/emoji/packs";
import { EmojiGlyph } from "./emoji";

type Group = { slug: string; name: string; e: [string, string][] };
const ICON: Record<string, string> = {
  "smileys-emotion": "😀", "people-body": "👋", "animals-nature": "🐻", "food-drink": "🍔",
  "travel-places": "✈️", activities: "⚽", objects: "💡", symbols: "❤️", flags: "🏁",
};
const RK = "anaija.emoji.recent";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RK) ?? "[]");
  } catch {
    return [];
  }
};

export function EmojiPicker({ onPick }: { onPick: (unicode: string) => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState("anaija");
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecent());
    let dead = false;
    import("@/lib/emoji/unicode.json").then((m) => !dead && setGroups(m.default as unknown as Group[]));
    return () => {
      dead = true;
    };
  }, []);

  const pick = (u: string) => {
    const next = [u, ...recent.filter((x) => x !== u)].slice(0, 28);
    setRecent(next);
    try {
      localStorage.setItem(RK, JSON.stringify(next));
    } catch {}
    onPick(u);
  };

  const items = useMemo<string[]>(() => {
    const s = q.trim().toLowerCase();
    if (s) {
      const art = EMOJI.filter((e) => e.label.toLowerCase().includes(s) || e.id.includes(s)).map((e) => e.u);
      const rest = groups.flatMap((g) => g.e.filter(([, n]) => n.includes(s)).map(([u]) => u));
      return [...new Set([...art, ...rest])].slice(0, 160);
    }
    if (tab === "recent") return recent;
    if (tab === "anaija") return EMOJI.map((e) => e.u);
    return groups.find((g) => g.slug === tab)?.e.map(([u]) => u) ?? [];
  }, [q, tab, groups, recent]);

  const tabBtn = (id: string, label: string, title: string) => (
    <button
      key={id}
      type="button"
      title={title}
      aria-label={title}
      aria-selected={tab === id && !q}
      onClick={() => {
        setQ("");
        setTab(id);
      }}
      className={`grid size-9 shrink-0 place-items-center rounded-full text-[18px] transition-colors ${tab === id && !q ? "bg-surface-elevated" : "opacity-70 hover:opacity-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-surface-subtle pb-1 pt-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emoji"
          className="mb-1 h-9 w-full rounded-full bg-white/8 px-4 text-[13px] text-fg outline-none placeholder:text-muted"
        />
        {!q && (
          <div className="no-scrollbar flex gap-0.5 overflow-x-auto">
            {tabBtn("recent", "🕘", "Recent")}
            {tabBtn("anaija", "💚", "Anaija")}
            {groups.map((g) => tabBtn(g.slug, ICON[g.slug.replace(/_/g, "-")] ?? g.e[0][0], g.name))}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-secondary text-muted">{tab === "recent" && !q ? "Emoji you use show up here." : "Nothing found."}</p>
      ) : (
        <div className="grid grid-cols-8 gap-0.5 pt-1">
          {items.map((u) => (
            <button key={u} type="button" onClick={() => pick(u)} className="grid aspect-square place-items-center rounded-xl transition hover:bg-white/8 active:scale-90">
              <EmojiGlyph code={u} size={30} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
