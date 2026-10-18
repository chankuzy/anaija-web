import { api, ApiError } from "./client";

export const profileApi = {
  // Same rule as Flutter: 200 = available, 409/422 = taken, anything else is "unknown".
  usernameAvailable: async (username: string): Promise<boolean> => {
    try {
      await api.get("username-check", { username });
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) return false;
      throw e;
    }
  },

  complete: (body: { username: string; name: string; bio?: string }) =>
    api.post<{ message: string }>("profile-complete", body),
};
