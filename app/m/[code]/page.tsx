import type { Metadata } from "next";
import { Suspense } from "react";
import { MomentView } from "@/components/moments/moment-view";
import { getMomentMeta } from "@/lib/server/community-public";
import { momentMetadata } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const m = await getMomentMeta(code);
  if (!m) return { title: "Moment" };
  return momentMetadata(code.toLowerCase(), m);
}

async function Inner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MomentView code={code.toLowerCase()} />;
}

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
