import type { Metadata } from "next";
import { Suspense } from "react";
import { ThreadView } from "@/components/messaging/thread-view";

export const metadata: Metadata = { title: "Messages" };

// params is awaited inside Suspense because cacheComponents is on.
async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreadView key={id} id={id} />;
}

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Inner params={params} />
    </Suspense>
  );
}
