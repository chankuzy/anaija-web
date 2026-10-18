import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const TOKEN_COOKIE = "anaija_token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // matches TOKEN_TTL_DAYS in _shared/auth.ts

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function readToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export function setTokenCookie(res: NextResponse, token: string) {
  res.cookies.set(TOKEN_COOKIE, token, { ...base, maxAge: MAX_AGE_SECONDS });
}

export function clearTokenCookie(res: NextResponse) {
  res.cookies.set(TOKEN_COOKIE, "", { ...base, maxAge: 0 });
}
