import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeSwitch } from "@/components/landing/home-switch";
import { getLandingData } from "@/lib/server/landing";
import { resolveInitialAuth } from "@/lib/server/initial-auth";
import { abs, card } from "@/lib/share/meta";

const TITLE = "Anaija — Your campus. A whole world inside.";
const DESCRIPTION =
  "The social home for campus life. Class libraries, anonymous discussions, a campus marketplace, reels and everything happening around you.";

export const metadata: Metadata = {
  ...card({ title: TITLE, description: DESCRIPTION, url: abs("/"), image: abs("/brand/app_icon.png") }),
  title: { absolute: TITLE },
};

// Everyone lands on the feed. Signed-out visitors also get public communities and marketplace listings
// (token-less reads, reduced to safe DTOs in lib/server/landing); signed-in people need none of it.
async function Home() {
  const auth = await resolveInitialAuth();
  const data = auth.status === "authed" ? { communities: [], tiles: [] } : await getLandingData();
  const listings = data.tiles.filter((t) => t.kind === "listing").slice(0, 8);
  return <HomeSwitch communities={data.communities} listings={listings} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Home />
    </Suspense>
  );
}
