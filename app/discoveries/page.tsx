import type { Metadata } from "next";
import { DiscoveriesView } from "@/components/discoveries/discoveries-view";

export const metadata: Metadata = { title: "Discoveries" };

export default function DiscoveriesPage() {
  return <DiscoveriesView />;
}
