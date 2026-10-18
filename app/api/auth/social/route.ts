import { NextRequest, NextResponse } from "next/server";
import { callFunction, clientIp, sameOrigin } from "@/lib/server/upstream";
import { setTokenCookie } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  let input: { provider?: unknown; token?: unknown };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 422 });
  }
  if (input.provider !== "google" || typeof input.token !== "string" || input.token.length < 20 || input.token.length > 4096) {
    return NextResponse.json({ message: "Invalid request." }, { status: 422 });
  }

  let up: Response;
  try {
    up = await callFunction("social-auth", {
      method: "POST",
      body: JSON.stringify({ provider: "google", token: input.token }),
      contentType: "application/json",
      ip: clientIp(req),
    });
  } catch {
    return NextResponse.json({ message: "Network error. Please try again." }, { status: 502 });
  }

  const data = (await up.json().catch(() => null)) as
    | { token?: string; message?: string; [k: string]: unknown }
    | null;

  if (!up.ok || !data?.token) {
    return NextResponse.json(data ?? { message: "Something went wrong." }, {
      status: up.ok ? 502 : up.status,
    });
  }

  // The token goes into the httpOnly cookie and never reaches client JS.
  const { token, ...rest } = data;
  const res = NextResponse.json(rest);
  setTokenCookie(res, token);
  return res;
}
