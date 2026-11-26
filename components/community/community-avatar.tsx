"use client";

import { Avatar } from "@/components/ui/avatar";

// Words that carry no identity of their own, so they never make it into the abbreviation.
const STOP = new Set(["and", "of", "the", "for", "in", "at", "to", "on", "a", "an", "&"]);
const GENERIC = new Set(["department", "dept", "faculty", "school", "college", "institute", "official", "community", "group"]);
// Hand-picked hues that stay readable on both light and dark canvases.
const HUES = [12, 32, 150, 172, 205, 232, 262, 292, 330];

/**
 * "Information and Communication Engineering · AFIT" -> "ICE"
 * "ICE OFFICIAL"                                    -> "ICE"
 * "Faculty of Engineering"                          -> "ENG"
 * "Department of Mechanical Engineering"            -> "ME"
 * "GET 207 Applied Mechanics"                       -> "GET"
 */
export function abbreviate(name: string): string {
  const head = name.split(/\s[·•|–—-]\s|[([]/)[0].trim();
  const code = head.match(/^([A-Za-z]{2,4})\s?\d{2,4}\b/);
  if (code) return code[1].toUpperCase();
  const words = head.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const sig = words.filter((w) => !STOP.has(w.toLowerCase()) && !GENERIC.has(w.toLowerCase()));
  const pool = sig.length ? sig : words;
  if (!pool.length) return "?";
  if (pool.length === 1) {
    const w = pool[0];
    return (w === w.toUpperCase() && w.length <= 5 ? w : w.slice(0, 3)).toUpperCase();
  }
  return pool.slice(0, 4).map((w) => w[0]).join("").toUpperCase();
}

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

// A community picture when it has one, otherwise a generated initials badge (stable colour per name).
export function CommunityAvatar({ url, name, size = 48 }: { url?: string | null; name: string; size?: number }) {
  if (url) return <Avatar url={url} name={name} size={size} />;
  const text = abbreviate(name);
  const h = hueOf(name);
  const k = text.length <= 2 ? 0.4 : text.length === 3 ? 0.32 : 0.27;
  return (
    <span
      role="img"
      aria-label={name}
      className="grid shrink-0 select-none place-items-center rounded-full font-extrabold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * k)),
        letterSpacing: "-0.02em",
        background: `hsl(${h} 70% 55% / 0.18)`,
        color: `color-mix(in srgb, hsl(${h} 75% 50%) 65%, var(--color-fg))`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 70% 50% / 0.28)`,
      }}
    >
      {text}
    </span>
  );
}
