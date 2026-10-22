// Generates every PWA / favicon asset from one source image.
//   node scripts/gen-pwa-icons.mjs
//   SRC=public/brand/anaija_logo_master.svg node scripts/gen-pwa-icons.mjs
// Tunables (fraction of the icon the logo mark fills):
//   FILL_ANY=0.9  FILL_APPLE=0.78  FILL_MASK=0.62   TRIM=0 disables the empty-border trim
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = process.env.SRC ?? "public/brand/app_icon.png";
const FILL_ANY = Number(process.env.FILL_ANY ?? 0.9);
const FILL_APPLE = Number(process.env.FILL_APPLE ?? 0.78);
const FILL_MASK = Number(process.env.FILL_MASK ?? 0.62);
const FALLBACK_BG = { r: 10, g: 10, b: 10, alpha: 1 };

const meta = await sharp(SRC).metadata();
console.log(`source: ${SRC} (${meta.width}x${meta.height})`);

// Background = the logo's own corner colour (dark fallback if the corner is transparent).
const [r, g, b, a] = await sharp(SRC).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
const bg = a === 255 ? { r, g, b, alpha: 1 } : FALLBACK_BG;

// Cut away the empty border so the mark itself can fill the icon.
let mark = await sharp(SRC).ensureAlpha().png().toBuffer();
if (process.env.TRIM !== "0") {
  try {
    const trimmed = await sharp(SRC).ensureAlpha().trim({ threshold: 12 }).png().toBuffer();
    const t = await sharp(trimmed).metadata();
    if ((t.width ?? 0) >= 32 && (t.height ?? 0) >= 32) {
      mark = trimmed;
      console.log(`trimmed mark: ${t.width}x${t.height} (was ${meta.width}x${meta.height})`);
    } else {
      console.warn("trim left almost nothing, using the untrimmed source");
    }
  } catch {
    console.warn("trim failed, using the untrimmed source");
  }
}

async function tile(n, fill) {
  const box = Math.max(1, Math.round(n * fill));
  const inner = await sharp(mark).resize(box, box, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
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

await writeFile("public/icons/icon-192.png", await tile(192, FILL_ANY));
await writeFile("public/icons/icon-512.png", await tile(512, FILL_ANY));
await writeFile("public/icons/maskable-512.png", await tile(512, FILL_MASK));
await writeFile("app/apple-icon.png", await tile(180, FILL_APPLE));
await writeFile("app/icon.png", await tile(192, FILL_ANY));
await writeFile(
  "app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await tile(size, FILL_ANY) })))),
);
console.log(`icons written (fill: any ${FILL_ANY}, apple ${FILL_APPLE}, maskable ${FILL_MASK})`);
