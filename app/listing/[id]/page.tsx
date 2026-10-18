import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingView } from "@/components/listing/listing-view";

export const metadata: Metadata = { title: "Listing" };

// params is awaited inside Suspense because cacheComponents is on.
async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingView id={id} />;
}

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Inner params={params} />
    </Suspense>
  );
}
