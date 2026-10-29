import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/stickers";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${inner}</svg>\n`;

function badge(label, fill, rot) {
  const size = Math.max(52, Math.min(120, Math.floor(400 / (label.length * 0.62))));
  return wrap(
    `<g transform="rotate(${rot} 256 256)"><rect x="28" y="136" width="456" height="240" rx="64" fill="${fill}" stroke="#fff" stroke-width="16"/>` +
      `<text x="256" y="${Math.round(256 + size * 0.34)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${size}" text-anchor="middle" fill="#fff">${esc(label)}</text></g>`,
  );
}

const ink = "#3b2a1a";
const face = (fill, inner) => wrap(`<circle cx="256" cy="256" r="240" fill="#fff"/><circle cx="256" cy="256" r="222" fill="${fill}"/>${inner}`);
const dot = (x, y, r = 22) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`;
const line = (d, w = 18, c = ink) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const heart = (cx, cy) => `<path transform="translate(${cx - 50} ${cy - 46})" d="M50 92 C8 60 4 28 28 14 C42 6 50 18 50 26 C50 18 58 6 72 14 C96 28 92 60 50 92Z" fill="#e11d48"/>`;
const SKIN = "#FFC83D";

const packs = [
  {
    id: "naija-vibes",
    name: "Naija Vibes",
    items: [
      ["wahala", "Wahala", badge("Wahala", "#e11d48", -6)],
      ["nowahala", "No wahala", badge("No wahala", "#16a34a", 4)],
      ["omo", "Omo!", badge("Omo!", "#7c3aed", -4)],
      ["sharp", "Sharp!", badge("Sharp!", "#0ea5e9", 5)],
      ["abeg", "Abeg", badge("Abeg", "#f97316", -5)],
      ["chai", "Chai!", badge("Chai!", "#db2777", 4)],
      ["nawa", "Nawa", badge("Nawa", "#0d9488", -3)],
      ["gbam", "Gbam!", badge("Gbam!", "#ca8a04", 6)],
      ["oya", "Oya!", badge("Oya!", "#2563eb", -5)],
      ["echoke", "E choke!", badge("E choke!", "#9333ea", 3)],
    ],
  },
  {
    id: "faces",
    name: "Faces",
    items: [
      ["smile", "Smile", face(SKIN, dot(170, 210) + dot(342, 210) + line("M150 310 Q256 410 362 310"))],
      ["laugh", "Laughing", face(SKIN, line("M130 220 Q170 170 210 220") + line("M302 220 Q342 170 382 220") + `<path d="M140 290 Q256 460 372 290 Z" fill="#7a1f12" stroke="${ink}" stroke-width="14" stroke-linejoin="round"/>`)],
      ["love", "In love", face(SKIN, heart(170, 215) + heart(342, 215) + line("M150 315 Q256 410 362 315"))],
      ["cry", "Crying", face(SKIN, dot(170, 210) + dot(342, 210) + line("M160 385 Q256 305 352 385") + `<path d="M150 262 q-18 40 0 56 q18 -16 0 -56Z" fill="#38bdf8"/><path d="M362 262 q-18 40 0 56 q18 -16 0 -56Z" fill="#38bdf8"/>`)],
      ["shock", "Shocked", face(SKIN, `<circle cx="170" cy="200" r="40" fill="#fff" stroke="${ink}" stroke-width="12"/><circle cx="342" cy="200" r="40" fill="#fff" stroke="${ink}" stroke-width="12"/>` + dot(170, 200, 14) + dot(342, 200, 14) + `<ellipse cx="256" cy="355" rx="38" ry="52" fill="${ink}"/>`)],
      ["cool", "Cool", face(SKIN, `<path d="M100 180 h140 v50 a40 40 0 0 1 -40 40 h-60 a40 40 0 0 1 -40 -40z" fill="#111"/><path d="M272 180 h140 v50 a40 40 0 0 1 -40 40 h-60 a40 40 0 0 1 -40 -40z" fill="#111"/><rect x="236" y="190" width="40" height="14" fill="#111"/>` + line("M170 335 Q256 395 350 315"))],
      ["angry", "Angry", face("#FF7A59", line("M120 160 L220 200") + line("M392 160 L292 200") + dot(175, 240) + dot(337, 240) + line("M170 385 Q256 325 342 385"))],
      ["sleepy", "Sleepy", face(SKIN, line("M130 220 Q170 250 210 220") + line("M302 220 Q342 250 382 220") + `<ellipse cx="256" cy="345" rx="26" ry="20" fill="${ink}"/><text x="378" y="130" font-size="84" font-weight="800" fill="${ink}" font-family="Arial, sans-serif">z</text>`)],
      ["wink", "Wink", face(SKIN, dot(170, 210) + line("M300 218 Q342 186 384 218") + line("M150 310 Q256 410 362 310"))],
    ],
  },
];

const manifest = { packs: [] };
for (const p of packs) {
  mkdirSync(`${OUT}/${p.id}`, { recursive: true });
  for (const [id, , svg] of p.items) writeFileSync(`${OUT}/${p.id}/${id}.svg`, svg);
  manifest.packs.push({
    id: p.id,
    name: p.name,
    creator: "Anaija",
    license: "Original artwork by Anaija",
    format: "svg",
    size: 512,
    stickers: p.items.map(([id, label]) => ({ id, label })),
  });
}
writeFileSync("lib/stickers/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`stickers: ${manifest.packs.map((p) => `${p.id}(${p.stickers.length})`).join(", ")}`);
