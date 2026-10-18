// Shape taken from the otp-verify response. profile-get's exact shape is still to be confirmed.
export interface AuthUser {
  id: number;
  name: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  links: unknown;
  is_verified: boolean;
  profile_completed: boolean;
  provider: string | null;
  institution_id: number | null;
  campus_verified: boolean;
  cover?: string | null;
}
