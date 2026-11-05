import type { Metadata } from "next";
import { CommunitySearch } from "@/components/community/community-search";

export const metadata: Metadata = { title: "Search communities" };

export default function CommunitySearchPage() {
  return <CommunitySearch />;
}
