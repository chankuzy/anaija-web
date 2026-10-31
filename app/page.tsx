import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeFeed } from "@/components/home/home-feed";
import { HomeGate } from "@/components/landing/home-gate";
import { LandingPage } from "@/components/landing/landing-page";
import { resolveInitialAuth } from "@/lib/server/initial-auth";
import { abs, card } from "@/lib/share/meta";

const TITLE = "Anaija — Your campus. A whole world inside.";
const DESCRIPTION =
  "The social home for campus life. Class libraries, anonymous discussions, a campus marketplace, reels and everything happening around you.";

export const metadata: Metadata = {
  ...card({ title: TITLE, description: DESCRIPTION, url: abs("/"), image: abs("/brand/app_icon.png") }),
  title: { absolute: TITLE },
};

// Signed-in people keep the feed. Signed-out visitors get the landing page. Only the variant that can be needed is
// rendered on the server; HomeGate swaps (or asks for a refresh) if the client's session turns out to differ.
async function Home() {
  const auth = await resolveInitialAuth();
  const guest = auth.status === "authed" ? null : <LandingPage />;
  const feed = auth.status === "guest" ? null : <HomeFeed />;
  return <HomeGate guest={guest}>{feed}</HomeGate>;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Home />
    </Suspense>
  );
}
