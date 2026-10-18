import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/upstream";
import { clearTokenCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  // NOTE: the backend has no token-revoke endpoint; this only clears the browser cookie.
  const res = NextResponse.json({ ok: true });
  clearTokenCookie(res);
  return res;
}
