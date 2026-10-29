// Pure edit model + export. Crop and strokes are normalised (0..1) against the ROTATED image, so the same
// numbers drive the on-screen preview and the full-resolution export and the two always agree.
import { FULL_CROP, isFullCrop, type Crop } from "@/lib/create/image-pipeline";
import { IMAGE_FILTERS, applyColorMatrix, isIdentity } from "@/lib/create/presets";

export type Rotation = 0 | 90 | 180 | 270;
export interface Stroke {
  color: string;
  /** Line width as a fraction of the (rotated) image width. */
  w: number;
  pts: [number, number][];
}
export interface ChatEdit {
  rot: Rotation;
  crop: Crop;
  filterIdx: number;
  strokes: Stroke[];
}

export const blankEdit = (): ChatEdit => ({ rot: 0, crop: FULL_CROP, filterIdx: 0, strokes: [] });
export const isEditedImage = (e?: ChatEdit) => !!e && (e.rot !== 0 || !isFullCrop(e.crop) || e.filterIdx !== 0 || e.strokes.length > 0);

/** Quarter turn clockwise. dims = size of the image BEFORE the turn. Crop and strokes turn with it. */
export function rotateEdit(e: ChatEdit, dims: { w: number; h: number }): ChatEdit {
  const c = e.crop;
  return {
    rot: ((e.rot + 90) % 360) as Rotation,
    crop: { left: 1 - c.bottom, top: c.left, right: 1 - c.top, bottom: c.right },
    filterIdx: e.filterIdx,
    strokes: e.strokes.map((s) => ({
      color: s.color,
      w: (s.w * dims.w) / dims.h,
      pts: s.pts.map(([x, y]) => [1 - y, x] as [number, number]),
    })),
  };
}

export function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke, ox: number, oy: number, sx: number, sy: number, unit: number) {
  if (!s.pts.length) return;
  const lw = Math.max(1, s.w * unit);
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const [x0, y0] = s.pts[0];
  if (s.pts.length === 1) {
    ctx.beginPath();
    ctx.arc(ox + x0 * sx, oy + y0 * sy, lw / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(ox + x0 * sx, oy + y0 * sy);
  for (let i = 1; i < s.pts.length; i++) ctx.lineTo(ox + s.pts[i][0] * sx, oy + s.pts[i][1] * sy);
  ctx.stroke();
}

type Mat = [number, number, number, number, number, number];
/** Affine matrix that turns a w x h image clockwise by rot. */
function quarter(rot: Rotation, w: number, h: number): Mat {
  switch (rot) {
    case 90:
      return [0, 1, -1, 0, h, 0];
    case 180:
      return [-1, 0, 0, -1, w, h];
    case 270:
      return [0, -1, 1, 0, 0, w];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MAX_EDGE = 2560;
const MAX_PIXELS = 6_000_000; // Safari/iOS canvas ceiling is far above this; stays safe on low-end phones.

function toBlob(c: HTMLCanvasElement, type: string, q: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image encode failed"))), type, q));
}

/** Rotated copy of an already-small preview blob, plus its size. */
export async function rotatePreview(blob: Blob, rot: Rotation): Promise<{ url: string; w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  try {
    const turned = rot === 90 || rot === 270;
    const w = turned ? bmp.height : bmp.width;
    const h = turned ? bmp.width : bmp.height;
    if (rot === 0) return { url: URL.createObjectURL(blob), w, h };
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const m = quarter(rot, bmp.width, bmp.height);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(bmp, 0, 0);
    return { url: URL.createObjectURL(await toBlob(c, "image/jpeg", 0.85)), w, h };
  } finally {
    bmp.close();
  }
}

/** Full-resolution export from the ORIGINAL: rotate, crop, filter, then strokes on top. Metadata is dropped. */
export async function exportChatImage(source: File, e: ChatEdit): Promise<File> {
  const bmp = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const w = bmp.width;
    const h = bmp.height;
    const turned = e.rot === 90 || e.rot === 270;
    const rw = turned ? h : w;
    const rh = turned ? w : h;
    const cx = clamp(e.crop.left * rw, 0, rw - 1);
    const cy = clamp(e.crop.top * rh, 0, rh - 1);
    const cw = Math.max(1, clamp(e.crop.right * rw, 1, rw) - cx);
    const ch = Math.max(1, clamp(e.crop.bottom * rh, 1, rh) - cy);
    let s = Math.min(1, MAX_EDGE / Math.max(cw, ch));
    if (cw * s * ch * s > MAX_PIXELS) s *= Math.sqrt(MAX_PIXELS / (cw * s * ch * s));
    const outW = Math.max(1, Math.round(cw * s));
    const outH = Math.max(1, Math.round(ch * s));

    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const matrix = IMAGE_FILTERS[e.filterIdx]?.matrix ?? IMAGE_FILTERS[0].matrix;
    const ctx = c.getContext("2d", { willReadFrequently: !isIdentity(matrix) });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#fff"; // JPEG has no alpha; transparent PNGs flatten onto white
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    const m = quarter(e.rot, w, h);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(bmp, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (!isIdentity(matrix)) {
      const img = ctx.getImageData(0, 0, outW, outH);
      applyColorMatrix(img, matrix);
      ctx.putImageData(img, 0, 0);
    }
    for (const st of e.strokes) paintStroke(ctx, st, -cx * s, -cy * s, rw * s, rh * s, rw * s);

    const blob = await toBlob(c, "image/jpeg", 0.9);
    return new File([blob], `edited_${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}

/** Light preview (long edge <= 1600) for the editor. Falls back to an <img> decode when createImageBitmap refuses the file. */
export async function makeEditPreview(file: Blob, edge = 1600): Promise<Blob> {
  const draw = async (src: CanvasImageSource, w: number, h: number) => {
    const s = Math.min(1, edge / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return toBlob(c, "image/jpeg", 0.88);
  };
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      return await draw(bmp, bmp.width, bmp.height);
    } finally {
      bmp.close();
    }
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return await draw(img, img.naturalWidth, img.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
