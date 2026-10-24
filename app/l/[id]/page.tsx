import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingView } from "@/components/listing/listing-view";
import { ListingSkeleton } from "@/components/ui/skeleton";
import type { ListingFull } from "@/lib/api/listing";
import { getPublicPost } from "@/lib/server/public";
import { listingMetadata, unavailable } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicPost(Number(id));
  if (post && post.type === "listing") return listingMetadata(post);
  return post === undefined ? { title: "Anaija" } : unavailable("Listing");
}

// params is awaited inside Suspense because cacheComponents is on.
async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPublicPost(Number(id));
  if (post && post.type !== "listing") redirect(`/p/${id}`); // one canonical URL per item
  return <ListingView id={id} initial={post === undefined ? undefined : (post as unknown as ListingFull | null)} />;
}

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <Inner params={params} />
    </Suspense>
  );
}
