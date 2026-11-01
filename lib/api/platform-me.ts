import { api, ApiError } from "./client";

/** True only for active platform staff. Everyone else gets a 404 from the server, which means "no". */
export async function isPlatformStaff(): Promise<boolean> {
  try {
    await api.get("platform/me");
    return true;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return false;
    throw e;
  }
}
