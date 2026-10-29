import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinView } from "@/components/community/join-view";
import { getInviteMeta } from "@/lib/server/community-public";
import { joinMetadata } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return joinMetadata(token, await getInviteMeta(token));
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
