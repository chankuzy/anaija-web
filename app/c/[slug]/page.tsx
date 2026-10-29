import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunityView } from "@/components/community/community-view";
import { getCommunityMeta } from "@/lib/server/community-public";
import { communityMetadata } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCommunityMeta(slug);
  if (!c) return { title: "Community" };
  return communityMetadata({ slug, name: c.name, description: c.description });
}

async function Inner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CommunityView slug={slug} />;
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
