export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;
export const SESSION_EXPIRED_EVENT = "anaija:session-expired";

function toQuery(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function request<T>(
  url: string,
  method: string,
  opts: { query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const hasBody = opts.body !== undefined;
  let res: Response;
  try {
    res = await fetch(url + toQuery(opts.query), {
      method,
      headers: hasBody
        ? { "Content-Type": "application/json", Accept: "application/json" }
        : { Accept: "application/json" },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "No internet connection.");
  }

  if (res.headers.get("X-Session-Expired")) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (Array.isArray(data)) data = { data }; // same root-list wrapping as ApiClient._handleResponse

  if (!res.ok) {
    const m = data as { message?: string; errors?: Record<string, unknown> };
    throw new ApiError(res.status, m.message ?? "Something went wrong.", m.errors);
  }
  return data as T;
}

const fnUrl = (fn: string) => `/api/fn/${fn}`;

export const api = {
  get: <T>(fn: string, query?: Query, signal?: AbortSignal) =>
    request<T>(fnUrl(fn), "GET", { query, signal }),
  post: <T>(fn: string, body: unknown = {}) => request<T>(fnUrl(fn), "POST", { body }),
  patch: <T>(fn: string, body: unknown = {}) => request<T>(fnUrl(fn), "PATCH", { body }),
  delete: <T>(fn: string, body?: unknown) => request<T>(fnUrl(fn), "DELETE", { body }),
};
