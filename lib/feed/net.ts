"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useDocumentFocus } from "./focus";

export type NetProfile = "lite" | "balanced" | "full";
// How much of the NEXT post's video to fetch ahead of time. Undefined = poster image only.
export type Warm = "meta" | "buffer";

interface Conn extends EventTarget {
  saveData?: boolean;
  effectiveType?: string;
  type?: string;
}
const getConn = (): Conn | undefined =>
  typeof navigator === "undefined" ? undefined : (navigator as Navigator & { connection?: Conn }).connection;

// lite: Save-Data or 2g. balanced: 3g, cellular, or unknown (Safari/Firefox). full: fast non-cellular.
export function netProfile(): NetProfile {
  const c = getConn();
  if (!c) return "balanced";
  if (c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g") return "lite";
  if (c.type === "cellular" || c.effectiveType === "3g") return "balanced";
  return c.effectiveType === "4g" ? "full" : "balanced";
}

function subscribeNet(cb: () => void) {
  const c = getConn();
  c?.addEventListener("change", cb);
  return () => c?.removeEventListener("change", cb);
}

export function useNetProfile(): NetProfile {
  return useSyncExternalStore(subscribeNet, netProfile, (): NetProfile => "balanced");
}

// Opt-in: set NEXT_PUBLIC_IMG_TRANSFORM=1 if your Supabase plan has image transformations.
// Requests a bucketed width (480/720/1080) so the CDN can cache variants instead of shipping originals.
const TRANSFORM = process.env.NEXT_PUBLIC_IMG_TRANSFORM === "1";
const OBJECT = "/storage/v1/object/public/";
export function sizedImage(url: string, profile: NetProfile): string {
  if (!TRANSFORM || typeof window === "undefined" || !url.includes(OBJECT)) return url;
  const want = Math.min(window.innerWidth, 560) * Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.min([480, 720, 1080].find((w) => w >= want) ?? 1080, profile === "lite" ? 720 : 1080);
  const quality = profile === "lite" ? 60 : 75;
  const sep = url.includes("?") ? "&" : "?";
  return url.replace(OBJECT, "/storage/v1/render/image/public/") + `${sep}width=${width}&quality=${quality}`;
}

function useSettled(key: unknown, ms: number): boolean {
  const [s, setS] = useState<{ key: unknown; ok: boolean }>({ key, ok: false });
  useEffect(() => {
    const t = window.setTimeout(() => setS({ key, ok: true }), ms);
    return () => window.clearTimeout(t);
  }, [key, ms]);
  return s.key === key && s.ok;
}

// Decides, per card, how much to fetch. Rules:
//  - the active post always gets everything;
//  - posters (small) are fetched a little ahead, less on slow/metered links, nothing behind on lite;
//  - the next VIDEO is only warmed after the viewer has stayed ~0.9s (fast swipers cost nothing),
//    metadata-only on balanced, buffered on full, never on lite, never while unfocused.
export function usePrefetchWindow(active: number) {
  const profile = useNetProfile();
  const focused = useDocumentFocus();
  const settled = useSettled(active, 900);
  return useCallback(
    (i: number): { near: boolean; warm: Warm | undefined } => {
      const d = i - active;
      const back = profile === "lite" ? 0 : 1;
      const fwd = profile === "lite" ? 1 : profile === "balanced" ? 2 : 3;
      const near = d >= -back && d <= fwd;
      let warm: Warm | undefined;
      if (d === 1 && focused) {
        if (profile === "full") warm = settled ? "buffer" : "meta";
        else if (profile === "balanced" && settled) warm = "meta";
      }
      return { near, warm };
    },
    [active, profile, focused, settled],
  );
}
