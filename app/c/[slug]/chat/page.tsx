import type { Metadata } from "next";
import { CommunityChat } from "@/components/community/community-chat";

export const metadata: Metadata = { title: "Chat" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CommunityChat slug={slug} />;
}
