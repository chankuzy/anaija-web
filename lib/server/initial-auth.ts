import { cache } from "react";
import { callFunction } from "@/lib/server/upstream";
import { readToken } from "@/lib/server/session";
import type { InitialAuth } from "@/lib/auth/auth-context";

// Resolved on the server so the very first paint already knows who is signed in. If the upstream is slow or
// down we answer "unknown" (never "guest"): the client keeps a neutral loading state and retries.
const BUDGET_MS = 1200;

// cache(): the layout and the home page both ask in the same request, but users/me is only called once.
export const resolveInitialAuth = cache(async (): Promise<InitialAuth> => {
  const token = await readToken();
  if (!token) return { status: "guest" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const up = await Promise.race([
      callFunction("users/me", { token }),
      new Promise<null>((r) => {
        timer = setTimeout(() => r(null), BUDGET_MS);
      }),
    ]);
    if (!up) return { status: "unknown" };
    if (up.status === 401) return { status: "guest" };
    if (!up.ok) return { status: "unknown" };
    return { status: "authed", user: await up.json() };
  } catch {
    return { status: "unknown" };
  } finally {
    clearTimeout(timer);
  }
});
