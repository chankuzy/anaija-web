"use client";

import { HomeFeed } from "@/components/home/home-feed";
import { AppLogo } from "@/components/ui/app-logo";
import { useAuth } from "@/lib/auth/auth-context";
import type { LandingCommunity, LandingTile } from "@/lib/server/landing";
import { PublicHome } from "./public-home";

// Signed in: the normal feed. Signed out: the same feed inside a light public frame. When someone signs in
// from the auth modal the page stays put and the app shell appears around it; nothing reloads.
export function HomeSwitch({ communities, listings }: { communities: LandingCommunity[]; listings: LandingTile[] }) {
  const { status } = useAuth();
  if (status === "authed") return <HomeFeed />;
  if (status === "guest") return <PublicHome communities={communities} listings={listings} />;
  return (
    <div className="grid h-dvh place-items-center">
      <AppLogo size={56} showWordmark={false} />
    </div>
  );
}
