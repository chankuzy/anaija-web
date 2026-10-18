import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = decodeURIComponent(username);
  return <ProfileView key={u} username={u} />;
}
