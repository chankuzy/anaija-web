import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentReader } from "@/components/post/content-reader";
import { getPublicPost } from "@/lib/server/public";
import { postMetadata, unavailable } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicPost(Number(id));
  if (post) return postMetadata(post);
  return post === null ? unavailable("Post") : { title: "Anaija" };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getPublicPost(Number(id));
  return <ContentReader id={id} initial={initial} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Inner params={params} />
    </Suspense>
  );
}
