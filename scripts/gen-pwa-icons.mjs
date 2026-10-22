// Generates every PWA / favicon asset from one source image, on a transparent background.
//   node scripts/gen-pwa-icons.mjs
//   SRC=public/brand/anaija_logo_master.svg node scripts/gen-pwa-icons.mjs
// Tunables:
//   FILL_ANY=0.9  FILL_APPLE=0.78  FILL_MASK=0.62   fraction of the icon the mark fills
//   TOL=40       how close to the corner colour counts as background (0-255)
//   KEY=0        don't strip an opaque background from the source
//   TRIM=0       don't crop the empty border first
//   APPLE_BG=#RRGGBB / MASK_BG=#RRGGBB   optional solid backgrounds (default: transparent)
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = process.env.SRC ?? "public/brand/app_icon.png";
const FILL_ANY = Number(process.env.FILL_ANY ?? 0.9);
const FILL_APPLE = Number(process.env.FILL_APPLE ?? 0.78);
const FILL_MASK = Number(process.env.FILL_MASK ?? 0.62);
const TOL = Number(process.env.TOL ?? 40);

const hex = (h) => {
  if (!h) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) throw new Error(`bad colour: ${h}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
};
const APPLE_BG = hex(process.env.APPLE_BG);
const MASK_BG = hex(process.env.MASK_BG);

const meta = await sharp(SRC).metadata();
console.log(`source: ${SRC} (${meta.width}x${meta.height})`);

// 1. Make the background transparent.
async function load() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const rawOpts = { raw: { width: w, height: h, channels: 4 } };
  if (data[3] < 250) {
    console.log("source corner is already transparent");
    return sharp(data, rawOpts).png().toBuffer();
  }
  if (process.env.KEY === "0") return sharp(data, rawOpts).png().toBuffer();

  const [kr, kg, kb] = [data[0], data[1], data[2]];
  const near = (i) => Math.abs(data[i] - kr) <= TOL && Math.abs(data[i + 1] - kg) <= TOL && Math.abs(data[i + 2] - kb) <= TOL;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const k = y * w + x;
    if (seen[k]) return;
    seen[k] = 1;
    if (near(k * 4)) stack.push(k);
  };
  for (let x = 0; x < w; x++) (push(x, 0), push(x, h - 1));
  for (let y = 0; y < h; y++) (push(0, y), push(w - 1, y));

  let cleared = 0;
  while (stack.length) {
    const k = stack.pop();
    data[k * 4 + 3] = 0;
    cleared++;
    const x = k % w;
    const y = (k - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  const pct = Math.round((cleared / (w * h)) * 100);
  console.log(`removed background rgb(${kr},${kg},${kb}): ${pct}% of pixels cleared`);
  if (pct > 90) console.warn("warning: almost everything was cleared, so the logo is close to the background colour. Lower TOL or use an SVG source");
  return sharp(data, rawOpts).png().toBuffer();
}

let mark = await load();

// 2. Cut away the empty border so the mark itself fills the icon.
if (process.env.TRIM !== "0") {
  try {
    const trimmed = await sharp(mark).trim({ threshold: 12 }).png().toBuffer();
    const t = await sharp(trimmed).metadata();
    if ((t.width ?? 0) >= 32 && (t.height ?? 0) >= 32) {
      mark = trimmed;
      console.log(`trimmed mark: ${t.width}x${t.height}`);
    } else {
      console.warn("trim left almost nothing, using the untrimmed source");
    }
  } catch {
    console.warn("trim failed, using the untrimmed source");
  }
}

// 3. Place the mark on a (transparent unless told otherwise) square.
async function tile(n, fill, bg = null) {
  const box = Math.max(1, Math.round(n * fill));
  const inner = await sharp(mark).resize(box, box, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: n, height: n, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: "centre" }])
    .png()
    .toBuffer();
}

// ICO container with PNG payloads (valid for every current browser).
function ico(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dirs = entries.map(({ size, buf }) => {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size;
    d[1] = size >= 256 ? 0 : size;
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    return d;
  });
  return Buffer.concat([head, ...dirs, ...entries.map((e) => e.buf)]);
}

await writeFile("public/icons/icon-192.png", await tile(192, FILL_ANY));
await writeFile("public/icons/icon-512.png", await tile(512, FILL_ANY));
await writeFile("public/icons/maskable-512.png", await tile(512, FILL_MASK, MASK_BG));
await writeFile("app/apple-icon.png", await tile(180, FILL_APPLE, APPLE_BG));
await writeFile("app/icon.png", await tile(192, FILL_ANY));
await writeFile(
  "app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await tile(size, FILL_ANY) })))),
);
console.log("icons written on a transparent background");
