import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedLanding } from "@/components/post/shared-landing";
import { getPublicPost } from "@/lib/server/public";
import { listingMetadata, postMetadata, unavailable } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicPost(Number(id));
  if (post) return post.type === "listing" ? listingMetadata(post) : postMetadata(post);
  return post === null ? unavailable("Post") : { title: "Anaija" };
}

// /p/{id} is the single canonical URL for every post kind (the old /read/{id} redirects here).
// params is awaited inside Suspense because cacheComponents is on.
async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getPublicPost(Number(id));
  return <SharedLanding id={id} initial={initial} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
