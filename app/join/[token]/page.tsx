import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinView } from "@/components/community/join-view";
import { joinMetadata } from "@/lib/share/meta";

export function generateMetadata(): Metadata {
  return joinMetadata();
}

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
