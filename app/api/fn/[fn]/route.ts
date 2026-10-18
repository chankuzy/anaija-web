import { NextRequest, NextResponse } from "next/server";
import { callFunction, clientIp, sameOrigin } from "@/lib/server/upstream";
import { clearTokenCookie, readToken } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const FN_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Dedicated routes handle otp-verify; the rest must never be reachable from a browser.
const BLOCKED = new Set(["otp-verify", "social-auth", "dev-login", "feed-debug"]);
// Guests only. The backend ignores tokens here, so never send one.
const NEVER_AUTHENTICATED = new Set(["feed-public"]);
const NULL_BODY = new Set([204, 205, 304]);

async function handle(req: NextRequest, ctx: { params: Promise<{ fn: string }> }) {
  const { fn } = await ctx.params;
  if (!FN_RE.test(fn) || BLOCKED.has(fn)) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  if (hasBody && !sameOrigin(req)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const token = NEVER_AUTHENTICATED.has(fn) ? null : await readToken();

  let up: Response;
  try {
    up = await callFunction(fn, {
      method,
      query: req.nextUrl.searchParams.toString(),
      body: hasBody ? await req.arrayBuffer() : null,
      contentType: req.headers.get("content-type"),
      token,
      ip: clientIp(req),
    });
  } catch {
    return NextResponse.json({ message: "Network error. Please try again." }, { status: 502 });
  }

  const res = new NextResponse(NULL_BODY.has(up.status) ? null : await up.arrayBuffer(), {
    status: up.status,
    headers: {
      "Content-Type": up.headers.get("content-type") ?? "application/json",
      "Cache-Control": "private, no-store",
    },
  });

  if (up.status === 401 && token) {
    clearTokenCookie(res);
    res.headers.set("X-Session-Expired", "1");
  }
  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
