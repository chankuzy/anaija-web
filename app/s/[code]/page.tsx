import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionView } from "@/components/community/session-view";
import { getSessionMeta } from "@/lib/server/community-public";
import { sessionMetadata } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const s = await getSessionMeta(code);
  if (!s) return { title: "Session" };
  return sessionMetadata(code.toLowerCase(), s);
}

async function Inner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SessionView code={code.toLowerCase()} />;
}

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
