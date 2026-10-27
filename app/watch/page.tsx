import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchView } from "@/components/home/watch-view";
import { getPublicPost } from "@/lib/server/public";

export const metadata: Metadata = { title: "Media" };

// A shared /watch?post=ID resolves the public copy on the server, so guests land on the exact post too.
async function Inner({ searchParams }: { searchParams: Promise<{ post?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.post) ? sp.post[0] : sp.post;
  const id = Number(raw);
  const initial = Number.isInteger(id) && id > 0 ? await getPublicPost(id) : null;
  return <WatchView initial={initial ?? null} />;
}

export default function WatchPage({ searchParams }: { searchParams: Promise<{ post?: string | string[] }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner searchParams={searchParams} />
    </Suspense>
  );
}
