import { api, ApiError } from "./client";
import { mediaUrl } from "./feed";
import { uploadBlob } from "./upload";

export interface ProfileUpdate {
  name?: string;
  username?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  links?: string[];
}

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

  // profile-update is a patch: only send what changed (links always), exactly like Flutter.
  update: (body: ProfileUpdate) => api.patch<{ username: string | null }>("profile-update", body),

  // Presigned PUT to storage, then attach the key to the user (profile-avatar / profile-cover).
  uploadAvatar: async (blob: Blob) => {
    const key = await uploadBlob(blob, `avatar_${Date.now()}.jpg`, "image/jpeg");
    const r = await api.post<{ avatar_url?: string | null }>("profile-avatar", { storage_key: key });
    return mediaUrl(r.avatar_url ?? null);
  },
  uploadCover: async (blob: Blob) => {
    const key = await uploadBlob(blob, `cover_${Date.now()}.jpg`, "image/jpeg");
    const r = await api.post<{ cover_url?: string | null }>("profile-cover", { storage_key: key });
    return mediaUrl(r.cover_url ?? null);
  },
};
