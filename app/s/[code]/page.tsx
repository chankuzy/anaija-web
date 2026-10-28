import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionView } from "@/components/community/session-view";
import { getSessionMeta } from "@/lib/server/community-public";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const s = await getSessionMeta(code);
  if (!s) return { title: "Session" };
  const title = `${s.title} · ${s.community}`;
  const description = `An anonymous session in ${s.community} on Anaija. Tap to join in.`;
  return { title, description, openGraph: { title, description } };
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
