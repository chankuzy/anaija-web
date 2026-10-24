// Where to send someone after sign-in. Only same-origin paths are accepted (no open redirect).
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/login/")) return null;
  return raw;
}

/** Client only. /login?next=<current path> so the visitor lands back on what they were doing. */
export const loginHref = () =>
  `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;

/** Client only. The validated ?next= of the current URL, else "/". */
export const readNext = () => safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/";
