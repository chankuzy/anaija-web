// Generates lib/icons/solar-map.ts: static imports of the OFFICIAL @solar-icons/react components.
// Flutter mapping: SolarIconsBold -> "bold", SolarIconsOutline -> "outline".
// Usage: node scripts/gen-solar-map.mjs [--verbose]
// Unresolvable names are skipped with a warning (tsc then flags any call site that needs them).
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ICON_DIR = join(ROOT, "node_modules/@solar-icons/react/dist/icons");
const OUT = join(ROOT, "lib/icons/solar-map.ts");
const STYLES = ["bold", "outline"];
const VERBOSE = process.argv.includes("--verbose");

// Same names as Flutter's SolarIcons* members (camelCase), 1:1.
// "home" and "userPlus" are intentionally NOT here: they are web aliases (see ALIASES) for the icons Flutter uses.
const FLUTTER = [
  "altArrowDown", "clapperboard", "infoCircle", "altArrowLeft", "altArrowRight", "arrowDown", "arrowRight", "arrowUp",
  "bag", "bag2", "bell", "bellOff", "book", "bookmark", "box", "boxMinimalistic", "bug", "buildings", "bus",
  "calendar", "camera", "cart", "caseMinimalistic", "chatLine", "chatRound", "chatRoundDots", "chatUnread",
  "checkCircle", "clockCircle", "closeCircle", "compass", "copy", "cropMinimalistic",
  "dangerCircle", "dangerTriangle", "diploma", "earth", "eye", "eyeClosed",
  "feed", "filters", "fire", "gallery", "galleryWide", "gift", "hamburgerMenu", "handHeart", "hashtag", "heart", "home2",
  "homeSmile", "letter", "link", "linkRound", "logout", "magnifier", "mapPointSchool", "menuDots", "moon",
  "musicLibrary2", "musicNote", "notebookMinimalistic", "paperclip", "pen", "pen2", "phone", "pin", "pinCircle",
  "pointOnMap", "questionCircle", "refresh", "repeat", "reply", "settings", "share", "shieldCross", "shop",
  "squareAcademicCap", "stars", "suitcase", "tag", "trashBin2", "trashBinMinimalistic", "tuning2",
  "user", "userPlusRounded", "userRounded", "usersGroupRounded", "verifiedCheck", "videocamera", "wifiRouter",
];

// Existing web icon names -> Solar equivalents (string | candidates[] | {bold, outline}).
// Flutter uses Material icons for some of these; the closest official Solar icon is used instead.
const ALIASES = {
  home: "homeSmile",
  search: "magnifier",
  message: "chatLine",
  userPlus: "userPlusRounded",
  dots: "menuDots",
  back: "altArrowLeft",
  chevronRight: "altArrowRight",
  chevronDown: "altArrowDown",
  music: "musicNote",
  school: "mapPointSchool",
  trash: { bold: "trashBin2", outline: "trashBinMinimalistic" },
  // Dart "plain" (paper plane) is not in the web package under that name; "plane" is the interim match
  // until verified visually (see scripts/_preview.mjs).
  plain: ["plain", "plane"],
  send: ["plain", "plane"],
  edit: "pen",
  plus: ["add", "plus", "addCircle"],
  check: ["check", "checkRead", "checkCircle"],
  close: ["close", "closeCircle"],
  volumeOn: ["volumeLoud"],
  volumeOff: ["volumeCross", "muted"],
  play: ["play"],
  userCross: ["userCrossRounded", "userCross"],
  forbidden: ["forbiddenCircle", "forbidden"],
  shareArrow: ["forwardRight", "forward"],
};

const kebab = (s) =>
  s.replace(/_/g, "").replace(/([a-z])([A-Z])/g, "$1-$2").replace(/([a-zA-Z])([0-9])/g, "$1-$2").toLowerCase();
const variants = (k) => [k, k.replace("wifi", "wi-fi")];
const arr = (v) => (Array.isArray(v) ? v : [v]);

const spec = {};
for (const n of FLUTTER) spec[n] = { bold: [n], outline: [n] };
for (const [k, v] of Object.entries(ALIASES)) {
  spec[k] =
    v && typeof v === "object" && !Array.isArray(v)
      ? { bold: arr(v.bold), outline: arr(v.outline) }
      : { bold: arr(v), outline: arr(v) };
}

function resolve(style, cands) {
  for (const c of cands)
    for (const v of variants(kebab(c)))
      if (existsSync(join(ICON_DIR, style, `${v}.mjs`))) return v;
  return null;
}
function exportName(style, file) {
  const src = readFileSync(join(ICON_DIR, style, `${file}.mjs`), "utf8");
  const m = src.match(/\bas\s+([A-Za-z0-9_]+Icon)\s*[};,]/) || src.match(/export\s*\{[^}]*\bas\s+(\w+)\s*\}/);
  return m ? m[1] : null;
}

const imports = new Map();
const rows = [];
const missing = [];
for (const [name, def] of Object.entries(spec).sort(([a], [b]) => a.localeCompare(b))) {
  const ids = {};
  const pending = [];
  let ok = true;
  for (const style of STYLES) {
    const file = resolve(style, def[style]);
    const exp = file && exportName(style, file);
    if (!file || !exp) {
      missing.push({ name, style, tried: def[style] });
      ok = false;
      break;
    }
    const id = `${style[0]}_${file.replace(/-/g, "_")}`;
    pending.push([id, `import { ${exp} as ${id} } from "@solar-icons/react/${style}/${file}";`]);
    ids[style] = id;
    if (VERBOSE) console.log(`${name} [${style}] -> ${file} (${exp})`);
  }
  if (!ok) continue;
  for (const [id, line] of pending) imports.set(id, line);
  rows.push(`  ${JSON.stringify(name)}: p(${ids.bold}, ${ids.outline}),`);
}

const out = `// GENERATED by scripts/gen-solar-map.mjs. Static imports of official @solar-icons/react components. Do not edit.
import type { ComponentType, SVGProps } from "react";
${[...imports.values()].sort().join("\n")}

export type SolarComp = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; color?: string }>;
const p = (bold: unknown, outline: unknown) => ({ bold: bold as SolarComp, outline: outline as SolarComp });

export const SOLAR = {
${rows.join("\n")}
};

export type IconName = keyof typeof SOLAR;
`;
writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${rows.length} icons, ${imports.size} component imports`);

if (missing.length) {
  console.warn("\nWARNING unresolved (skipped):");
  for (const m of missing) {
    const tok = kebab(m.tried[0]).split("-")[0];
    const near = readdirSync(join(ICON_DIR, m.style))
      .filter((f) => f.endsWith(".mjs") && f.includes(tok))
      .map((f) => f.slice(0, -4))
      .slice(0, 14);
    console.warn(` - ${m.name} [${m.style}] tried ${JSON.stringify(m.tried)}  near: ${near.join(", ") || "(none)"}`);
  }
}
