import { request } from "./client";
import type { AuthUser } from "./types";

export const authApi = {
  // Google ID token from Google Identity Services; the server route stores the Anaija token in a cookie.
  socialLogin: (token: string) =>
    request<{ is_new_user: boolean; user: AuthUser }>("/api/auth/social", "POST", {
      body: { provider: "google", token },
    }),

  session: async () =>
    (await request<{ user: AuthUser | null }>("/api/auth/session", "GET")).user,

  logout: () => request<{ ok: true }>("/api/auth/logout", "POST", { body: {} }),
};
