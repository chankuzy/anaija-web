import fs from "node:fs";
const raw = JSON.parse(fs.readFileSync("node_modules/unicode-emoji-json/data-by-group.json", "utf8"));
const arr = Array.isArray(raw) ? raw : raw.groups;
const out = arr.map((g) => ({ slug: g.slug, name: g.name, e: g.emojis.map((m) => [m.emoji, m.name]) }));
fs.writeFileSync("lib/emoji/unicode.json", JSON.stringify(out));
console.log("groups:", out.length, "emoji:", out.reduce((n, g) => n + g.e.length, 0));
