import type { Metadata } from "next";
import { FollowListView } from "@/components/profile/follow-list";

export const metadata: Metadata = { title: "Followers" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = decodeURIComponent(username);
  return <FollowListView key={u} username={u} kind="followers" />;
}
