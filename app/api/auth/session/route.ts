import { NextResponse } from "next/server";
import { callFunction } from "@/lib/server/upstream";
import { clearTokenCookie, readToken } from "@/lib/server/session";


// Equivalent of AuthService.validateToken(): confirm the token with users/me (formerly profile-get).
export async function GET() {
  const token = await readToken();
  if (!token) return NextResponse.json({ user: null });

  let up: Response;
  try {
    up = await callFunction("users/me", { token });
  } catch {
    // Offline/timeout: keep the cookie, let the client retry (Flutter also stays logged in here).
    return NextResponse.json({ message: "Network error." }, { status: 502 });
  }

  if (up.status === 401) {
    const res = NextResponse.json({ user: null });
    clearTokenCookie(res);
    return res;
  }
  if (!up.ok) return NextResponse.json({ message: "Something went wrong." }, { status: 502 });

  return NextResponse.json({ user: await up.json() });
}
