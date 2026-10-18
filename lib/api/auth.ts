import { api, request } from "./client";
import type { AuthUser } from "./types";

export const authApi = {
  requestOtp: (phone: string) =>
    api.post<{ message: string; expires_in: number }>("otp-request", { phone }),

  verifyOtp: (phone: string, code: string) =>
    request<{ is_new_user: boolean; user: AuthUser }>("/api/auth/otp-verify", "POST", {
      body: { phone, code },
    }),

  session: async () =>
    (await request<{ user: AuthUser | null }>("/api/auth/session", "GET")).user,

  logout: () => request<{ ok: true }>("/api/auth/logout", "POST", { body: {} }),
};
