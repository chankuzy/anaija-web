import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchView } from "@/components/home/watch-view";

export const metadata: Metadata = { title: "Reels" };

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <WatchView />
    </Suspense>
  );
}
