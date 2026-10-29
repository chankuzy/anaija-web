// User-made stickers. Blobs live in IndexedDB on this device. Sending one uploads the 512px WebP once and posts it
// as an image message tagged with CUSTOM_STICKER_BODY, which the thread renders as a bare sticker (no bubble).
import { uploadBlob } from "@/lib/api/upload";
import { onCacheClear } from "@/lib/cache/swr";

export const CUSTOM_STICKER_BODY = "::sticker::";
export const isCustomSticker = (m: { type: string; body?: string | null }) => m.type === "image" && m.body === CUSTOM_STICKER_BODY;

const DB = "anaija-stickers";
const STORE = "mine";
const MAX = 60;

export interface CustomSticker {
  id: string;
  blob: Blob;
  created: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(STORE, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error("IndexedDB unavailable"));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(req.result);
      tx.onerror = () => rej(tx.error ?? new Error("Transaction failed"));
      tx.onabort = () => rej(tx.error ?? new Error("Transaction aborted"));
    });
  } finally {
    db.close();
  }
}

if (typeof window !== "undefined") {
  onCacheClear(() => {
    try {
      indexedDB.deleteDatabase(DB);
    } catch {}
  });
}

export async function listCustom(): Promise<CustomSticker[]> {
  const all = (await run("readonly", (s) => s.getAll())) as CustomSticker[];
  return all.sort((a, b) => b.created - a.created);
}

export async function addCustom(blob: Blob): Promise<CustomSticker> {
  if ((await listCustom()).length >= MAX) throw new Error("limit");
  const s: CustomSticker = { id: crypto.randomUUID(), blob, created: Date.now() };
  await run("readwrite", (st) => st.put(s));
  return s;
}

export async function removeCustom(id: string): Promise<void> {
  await run("readwrite", (st) => st.delete(id));
}

/** 512x512 transparent WebP (PNG where WebP encoding is unsupported). fit = whole image, otherwise centre-fill. */
export async function renderSticker(file: Blob, o: { fit: boolean; round: boolean }): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.imageSmoothingQuality = "high";
    if (o.round) {
      const r = S * 0.2;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(S, 0, S, S, r);
      ctx.arcTo(S, S, 0, S, r);
      ctx.arcTo(0, S, 0, 0, r);
      ctx.arcTo(0, 0, S, 0, r);
      ctx.closePath();
      ctx.clip();
    }
    const k = (o.fit ? Math.min : Math.max)(S / bmp.width, S / bmp.height);
    const w = bmp.width * k;
    const h = bmp.height * k;
    ctx.drawImage(bmp, (S - w) / 2, (S - h) / 2, w, h);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Encode failed"))), "image/webp", 0.92));
  } finally {
    bmp.close();
  }
}

export async function uploadCustomSticker(blob: Blob): Promise<{ mediaKey: string; mediaType: string }> {
  const type = blob.type || "image/webp";
  const ext = type === "image/png" ? "png" : "webp";
  const key = await uploadBlob(new File([blob], `sticker.${ext}`, { type }), `sticker.${ext}`, type);
  return { mediaKey: key, mediaType: type };
}
