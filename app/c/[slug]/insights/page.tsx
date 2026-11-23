import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightsView } from "@/components/community/insights/insights-view";

export const metadata: Metadata = { title: "Community Insights", robots: { index: false, follow: false } };

async function Inner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <InsightsView slug={slug} />;
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
