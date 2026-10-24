import type { Metadata } from "next";
import { PostPage } from "@/components/post/post-page";
import { getPublicPost } from "@/lib/server/public";
import { postMetadata, unavailable } from "@/lib/share/meta";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicPost(Number(id));
  if (post) return postMetadata(post);
  return post === null ? unavailable("Post") : { title: "Anaija" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = await getPublicPost(Number(id));
  return <PostPage id={id} initial={initial} />;
}
