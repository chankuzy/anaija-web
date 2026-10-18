import { functionsUrl } from "./env";

export type UpstreamInit = {
  method?: string;
  query?: string;
  body?: ArrayBuffer | string | null;
  contentType?: string | null;
  token?: string | null;
  ip?: string | null;
};

/** Calls one Supabase Edge Function. Mirrors ApiClient in Flutter (15s timeout, Bearer token). */
export async function callFunction(fn: string, init: UpstreamInit = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.contentType) headers["Content-Type"] = init.contentType;
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  // Functions rate-limit by client IP (feed-public); without this every visitor shares our server IP.
  if (init.ip) headers["X-Forwarded-For"] = init.ip;

  const url = `${functionsUrl()}/${fn}${init.query ? `?${init.query}` : ""}`;
  return fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body ?? undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** Cookie is SameSite=Lax; this is a second check for state-changing requests. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
