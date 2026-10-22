// Generates every PWA / favicon asset from one source image.
//   node scripts/gen-pwa-icons.mjs            (uses public/brand/app_icon.png)
//   SRC=path/to/logo.svg node scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = process.env.SRC ?? "public/brand/app_icon.png";
const FALLBACK_BG = { r: 10, g: 10, b: 10, alpha: 1 };

const meta = await sharp(SRC).metadata();
console.log(`source: ${SRC} (${meta.width}x${meta.height})`);
if (Math.min(meta.width ?? 0, meta.height ?? 0) < 512) {
  console.warn("warning: source is under 512px, so the large icons are upscaled and will look soft");
}

// Background for maskable/apple icons = the logo's own corner colour (dark fallback if the corner is transparent).
const [r, g, b, a] = await sharp(SRC).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
const bg = a === 255 ? { r, g, b, alpha: 1 } : FALLBACK_BG;

const any = (n) => sharp(SRC).resize(n, n, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const flat = (n) => sharp(SRC).resize(n, n, { fit: "contain", background: bg }).flatten({ background: bg }).png().toBuffer();
async function maskable(n) {
  const size = Math.round(n * 0.72); // keeps the mark inside Android's circular safe zone
  const inner = await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: n, height: n, channels: 4, background: bg } })
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

await writeFile("public/icons/icon-192.png", await any(192));
await writeFile("public/icons/icon-512.png", await any(512));
await writeFile("public/icons/maskable-512.png", await maskable(512));
await writeFile("app/apple-icon.png", await flat(180));
await writeFile("app/icon.png", await any(192));
await writeFile(
  "app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await any(size) })))),
);
console.log("icons written: public/icons/*, app/icon.png, app/apple-icon.png, app/favicon.ico");
