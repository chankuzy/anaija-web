import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinView } from "@/components/community/join-view";

export const metadata: Metadata = { title: "Join a community", robots: { index: false, follow: false } };

async function Inner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinView token={token} />;
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
