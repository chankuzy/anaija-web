import type { AuthUser } from "@/lib/api/types";

// Flutter: needsProfileSetup = !profile_completed. A username is also treated as "done" so an
// existing account can never be pushed through profile-complete (which resets campus fields).
export const needsProfileSetup = (u: AuthUser | null) => !!u && !u.profile_completed && !u.username;
