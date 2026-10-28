import type { Metadata } from "next";
import { CommunitiesView } from "@/components/community/communities-view";

export const metadata: Metadata = { title: "Communities" };

export default function Page() {
  return <CommunitiesView />;
}
