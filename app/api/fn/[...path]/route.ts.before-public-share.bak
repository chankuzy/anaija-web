import { NextRequest, NextResponse } from "next/server";
import { callFunction, clientIp, sameOrigin } from "@/lib/server/upstream";
import { clearTokenCookie, readToken } from "@/lib/server/session";


const FN_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Sub-path segments (e.g. the post id). Must start alphanumeric so "." and ".." can never pass.
const SEG_RE = /^[A-Za-z0-9][A-Za-z0-9_.~-]{0,63}$/;
// Dedicated routes handle otp-verify; the rest must never be reachable from a browser.
const BLOCKED = new Set(["otp-request", "otp-verify", "social-auth", "dev-login", "feed-debug"]);
// Guests only. The backend ignores tokens here, so never send one.
const NEVER_AUTHENTICATED = new Set(["feed-public"]);
const NULL_BODY = new Set([204, 205, 304]);

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const [head, ...rest] = path;
  if (
    !head ||
    !FN_RE.test(head) ||
    BLOCKED.has(head) ||
    path.length > 4 ||
    !rest.every((s) => SEG_RE.test(s))
  ) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  if (hasBody && !sameOrigin(req)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const token = NEVER_AUTHENTICATED.has(head) ? null : await readToken();

  let up: Response;
  try {
    up = await callFunction(path.join("/"), {
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
