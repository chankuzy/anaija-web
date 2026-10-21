// Tolerant JSON readers: one odd field never blanks a screen.
export type Rec = Record<string, unknown>;
export const rec = (v: unknown): Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : {};
export const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
export const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
export const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);

// Accepts a bare array or an object wrapping one under any of `keys`.
export function listOf(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  const r = rec(raw);
  for (const k of keys) {
    const v = r[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}
